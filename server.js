const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'https://sierraadsels.nl',
  'https://www.sierraadsels.nl',
  'https://sierraadsels-frontend.pages.dev'
];

if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sierraadsels')
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// S3/R2 Client for image storage
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME;

// Multer setup for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit per file
});

// Schemas
const itemSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  src: { type: String, required: true },
  title: String,
  description: String,
  category: { type: String, required: true },
  order: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const categorySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  order: { type: Number, default: 0 },
  topText: String,
  bottomText: String
});

const siteContentSchema = new mongoose.Schema({
  _id: { type: String, default: 'singleton' },
  title: { type: String, default: 'Sierraadsels' },
  aboutText: { type: String, default: '' },
  contactEmail: { type: String, default: '' },
  contactPhone: { type: String, default: '' },
  heroTitle: { type: String, default: 'SIERRAADSELS' },
  heroSubtitle: { type: String, default: 'Unieke handgemaakte zilveren sieraden' },
  heroDescription: { type: String, default: '' },
  quoteText: { type: String, default: '' },
  ctaText: { type: String, default: '' },
  makerImage: { type: String, default: '' },
  makerTitle: { type: String, default: 'De Maker' },
  makerName: { type: String, default: 'Tilly' },
  makerDescription: { type: String, default: '' }
});

// Models
const Item = mongoose.model('Item', itemSchema);
const Category = mongoose.model('Category', categorySchema);
const SiteContent = mongoose.model('SiteContent', siteContentSchema);

// Auth middleware
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Routes

// Auth
app.post('/api/auth/login', async (req, res) => {
  const { password } = req.body;
  const hashedPassword = process.env.ADMIN_PASSWORD_HASH || bcrypt.hashSync('admin123', 10);
  
  if (bcrypt.compareSync(password, hashedPassword)) {
    const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '24h' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

// Items
app.get('/api/items', async (req, res) => {
  try {
    const items = await Item.find().sort({ order: 1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/items', authMiddleware, async (req, res) => {
  try {
    const item = new Item(req.body);
    await item.save();
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/items/:id', authMiddleware, async (req, res) => {
  try {
    const item = await Item.findOneAndUpdate(
      { id: req.params.id },
      req.body,
      { new: true }
    );
    res.json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/items/:id', authMiddleware, async (req, res) => {
  try {
    await Item.deleteOne({ id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Categories
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Category.find().sort({ order: 1 });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/categories/:id', authMiddleware, async (req, res) => {
  try {
    const category = await Category.findOneAndUpdate(
      { id: req.params.id },
      req.body,
      { new: true, upsert: true }
    );
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Site Content
app.get('/api/site-content', async (req, res) => {
  try {
    let content = await SiteContent.findById('singleton');
    if (!content) {
      content = new SiteContent();
      await content.save();
    }
    res.json(content);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/site-content', authMiddleware, async (req, res) => {
  try {
    const content = await SiteContent.findByIdAndUpdate(
      'singleton',
      req.body,
      { new: true, upsert: true }
    );
    res.json(content);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Image Upload
app.post('/api/upload', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const key = `images/${Date.now()}-${req.file.originalname}`;
    
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    }));

    const imageUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
    res.json({ url: imageUrl, key });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete Image
app.delete('/api/upload/:key', authMiddleware, async (req, res) => {
  try {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: req.params.key,
    }));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Initialize default categories if empty
async function initializeDefaults() {
  const count = await Category.countDocuments();
  if (count === 0) {
    const defaultCategories = [
      { id: 'ringen-1', name: 'Ringen 1', slug: 'ringen-1', order: 0 },
      { id: 'ringen-2', name: 'Ringen 2', slug: 'ringen-2', order: 1 },
      { id: 'armbanden', name: 'Armbanden', slug: 'armbanden', order: 2 },
      { id: 'halssieraden', name: 'Halssieraden', slug: 'halssieraden', order: 3 },
      { id: 'oorbellen', name: 'Oorbellen', slug: 'oorbellen', order: 4 },
      { id: 'in-opdracht', name: 'In Opdracht', slug: 'in-opdracht', order: 5 },
      { id: 'schilderwerk', name: 'Schilderwerk', slug: 'schilderwerk', order: 6 },
    ];
    await Category.insertMany(defaultCategories);
    console.log('Default categories created');
  }
  
  // Initialize site content if empty
  const siteContent = await SiteContent.findById('singleton');
  if (!siteContent) {
    await new SiteContent().save();
    console.log('Default site content created');
  }
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  await initializeDefaults();
});
