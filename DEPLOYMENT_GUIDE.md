# Deployment Guide

This guide provides instructions for deploying the UniHub Backend API to various environments.

## Table of Contents
1. [Local Development](#local-development)
2. [Production Deployment](#production-deployment)
3. [Database Setup](#database-setup)
4. [Environment Configuration](#environment-configuration)
5. [Security Best Practices](#security-best-practices)

## Local Development

### Prerequisites
- Node.js v14+ installed
- MySQL v8.0+ installed
- npm or yarn package manager

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/VihiITSolution/Unihub-backend.git
   cd Unihub-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Create MySQL database**
   ```sql
   CREATE DATABASE unihub_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

5. **Run migrations**
   ```bash
   npm run migrate
   ```

6. **Seed database (optional)**
   ```bash
   npm run seed
   ```

7. **Start development server**
   ```bash
   npm run dev
   ```

The server will be available at `http://localhost:3000`

## Production Deployment

### Option 1: Traditional Server (VPS/Dedicated)

#### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (using NodeSource)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install MySQL
sudo apt install -y mysql-server

# Install PM2 (Process Manager)
sudo npm install -g pm2
```

#### 2. Deploy Application

```bash
# Clone repository
cd /var/www
git clone https://github.com/VihiITSolution/Unihub-backend.git
cd Unihub-backend

# Install dependencies
npm install --production

# Configure environment
cp .env.example .env
nano .env  # Edit with production values
```

#### 3. Setup MySQL

```bash
sudo mysql_secure_installation

# Create database
sudo mysql -u root -p
```

```sql
CREATE DATABASE unihub_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'unihub_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON unihub_db.* TO 'unihub_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

#### 4. Run Migrations

```bash
NODE_ENV=production npm run migrate
```

#### 5. Start with PM2

```bash
pm2 start src/server.js --name unihub-backend
pm2 save
pm2 startup
```

#### 6. Setup Nginx (Reverse Proxy)

```bash
sudo apt install -y nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/unihub-backend
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/unihub-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 7. Setup SSL (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

### Option 2: Docker Deployment

#### 1. Create Dockerfile

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["node", "src/server.js"]
```

#### 2. Create docker-compose.yml

```yaml
version: '3.8'

services:
  mysql:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: ${DB_PASSWORD}
      MYSQL_DATABASE: ${DB_NAME}
    ports:
      - "3306:3306"
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - unihub-network

  backend:
    build: .
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DB_HOST: mysql
      DB_PORT: 3306
      DB_NAME: ${DB_NAME}
      DB_USER: root
      DB_PASSWORD: ${DB_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - mysql
    networks:
      - unihub-network

volumes:
  mysql_data:

networks:
  unihub-network:
```

#### 3. Deploy with Docker

```bash
docker-compose up -d
```

### Option 3: Cloud Platforms

#### Heroku

```bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create unihub-backend

# Add MySQL addon
heroku addons:create jawsdb:kitefin

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your_secret_key

# Deploy
git push heroku main

# Run migrations
heroku run npm run migrate
```

#### AWS Elastic Beanstalk

```bash
# Install EB CLI
pip install awsebcli

# Initialize
eb init

# Create environment
eb create unihub-backend-env

# Deploy
eb deploy
```

## Database Setup

### MySQL Configuration

For production, optimize MySQL settings:

```ini
# /etc/mysql/mysql.conf.d/mysqld.cnf

[mysqld]
max_connections = 200
innodb_buffer_pool_size = 1G
innodb_log_file_size = 256M
```

### Backup Strategy

Set up automated backups:

```bash
# Create backup script
cat > /usr/local/bin/backup-unihub-db.sh << 'EOF'
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/unihub"
mkdir -p $BACKUP_DIR
mysqldump -u root -p$MYSQL_ROOT_PASSWORD unihub_db | gzip > $BACKUP_DIR/unihub_$TIMESTAMP.sql.gz
# Keep only last 7 days
find $BACKUP_DIR -name "unihub_*.sql.gz" -mtime +7 -delete
EOF

chmod +x /usr/local/bin/backup-unihub-db.sh

# Add to crontab (daily at 2 AM)
echo "0 2 * * * /usr/local/bin/backup-unihub-db.sh" | crontab -
```

## Environment Configuration

### Production Environment Variables

```env
NODE_ENV=production
PORT=3000

# Database
DB_HOST=your-db-host
DB_PORT=3306
DB_NAME=unihub_db
DB_USER=unihub_user
DB_PASSWORD=strong_secure_password

# JWT
JWT_SECRET=very_long_random_secret_key_change_this
JWT_EXPIRE=24h

# CORS
CORS_ORIGIN=https://yourdomain.com

# File Upload
MAX_FILE_SIZE=10485760
UPLOAD_DIR=/var/www/uploads
```

## Security Best Practices

### 1. Environment Variables
- Never commit `.env` file to version control
- Use strong, unique passwords
- Rotate JWT secret regularly

### 2. Database Security
- Use separate database user with limited privileges
- Enable SSL for database connections
- Regular backups and test restore procedures

### 3. API Security
- Use HTTPS in production (SSL/TLS)
- Implement rate limiting
- Keep dependencies updated: `npm audit fix`
- Use helmet for security headers (already included)

### 4. Monitoring

Set up monitoring with PM2:

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

# Monitor application
pm2 monit
```

### 5. Logging

Configure application logging:

```javascript
// Add to src/config/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

## Health Checks

Configure health check endpoint for monitoring:

```bash
# Add to crontab for monitoring
*/5 * * * * curl -f http://localhost:3000/health || pm2 restart unihub-backend
```

## Scaling Considerations

### Horizontal Scaling
- Use load balancer (Nginx, HAProxy)
- Multiple application instances with PM2 cluster mode
- Shared session storage (Redis)

### Database Optimization
- Implement connection pooling (already configured in Sequelize)
- Use read replicas for read-heavy operations
- Implement caching layer (Redis)

## Troubleshooting

### Check Application Logs
```bash
pm2 logs unihub-backend
```

### Check System Resources
```bash
pm2 monit
htop
```

### Database Connection Issues
```bash
# Test MySQL connection
mysql -u unihub_user -p unihub_db

# Check MySQL status
sudo systemctl status mysql
```

### Restart Application
```bash
pm2 restart unihub-backend
```

## Maintenance

### Update Application
```bash
cd /var/www/Unihub-backend
git pull origin main
npm install
pm2 restart unihub-backend
```

### Database Migration
```bash
npm run migrate
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/VihiITSolution/Unihub-backend/issues
- Email: support@unihub.com
