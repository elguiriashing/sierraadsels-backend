# Sierraadsels Backend

## Environment Variables

Create a `.env` file with:

```
# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/sierraadsels

# JWT Secret (generate a random string)
JWT_SECRET=your-super-secret-jwt-key-here

# Admin Password (generate with bcrypt)
ADMIN_PASSWORD_HASH=$2a$10$... (bcrypt hash of your admin password)

# Cloudflare R2 (for image storage)
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=sierraadsels-images
R2_PUBLIC_URL=https://pub-<hash>.r2.dev

# Frontend URL (for CORS)
FRONTEND_URL=https://sierraadsels.com

# Port (Railway sets this automatically)
PORT=3001
```

## Generate Admin Password Hash

```bash
node -e "console.log(require('bcryptjs').hashSync('your-password', 10))"
```

## Deployment to Railway

1. Push backend folder to GitHub
2. Connect Railway to your repo
3. Add environment variables in Railway dashboard
4. Deploy!

## API Endpoints

- `POST /api/auth/login` - Login
- `GET /api/items` - Get all items
- `POST /api/items` - Create item (auth required)
- `PUT /api/items/:id` - Update item (auth required)
- `DELETE /api/items/:id` - Delete item (auth required)
- `GET /api/categories` - Get all categories
- `PUT /api/categories/:id` - Update category (auth required)
- `GET /api/site-content` - Get site content
- `PUT /api/site-content` - Update site content (auth required)
- `POST /api/upload` - Upload image (auth required)
- `DELETE /api/upload/:key` - Delete image (auth required)
