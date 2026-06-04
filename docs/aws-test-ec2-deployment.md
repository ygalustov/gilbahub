# AWS Test EC2 Deployment

This project can run on a single small EC2 instance for a test environment without introducing ECS, RDS, or a separate CI build pipeline.

## Recommended shape

- EC2 instance: `t3a.small` on `x86_64`
- OS: Ubuntu 24.04 LTS
- Storage: 30-50 GB gp3 EBS
- Runtime: Docker Engine + Docker Compose plugin
- Services on the instance:
  - `web` nginx container
  - `app` php-fpm container
  - `mysql` container

This matches the current repo layout in [docker-compose.yml](/Users/yury/work/gilba/docker-compose.yml:1), including the mounted `assets/` directory and local MySQL.

## Security groups

For a test environment, keep the instance simple but not wide open:

- Inbound `22/tcp`: `0.0.0.0/0` if you keep the current GitHub Actions SSH deploy workflow
- Inbound `80/tcp`: `0.0.0.0/0`
- Inbound `443/tcp`: `0.0.0.0/0`
- Do not open `3306/tcp`

Outbound can stay fully open for package installs and image pulls.

If you later move deploys to AWS SSM or a self-hosted runner on the instance, tighten `22/tcp` back down to your IP only.

## Repo files added for this setup

- [docker-compose.ec2.yml](/Users/yury/work/gilba/docker-compose.ec2.yml)
- [.github/workflows/deploy-test-ec2.yml](/Users/yury/work/gilba/.github/workflows/deploy-test-ec2.yml)

The EC2 compose file keeps the current dev-style bind mounts because they are the shortest path for a disposable test system.

## One-time server bootstrap

SSH into the instance and install Docker:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker
docker --version
docker compose version
```

Create the app directory:

```bash
sudo mkdir -p /srv/gilba
sudo chown -R "$USER":"$USER" /srv/gilba
```

Create the app directory and enter it:

```bash
mkdir -p /srv/gilba
cd /srv/gilba
```

Create a root `.env.ec2` file for Docker Compose variable injection:

```dotenv
APP_ENV=testing
APP_DEBUG=false
APP_URL=http://test.example.com
APP_KEY=

DB_DATABASE=gilba
DB_USERNAME=gilba
DB_PASSWORD=change_me
MYSQL_ROOT_PASSWORD=change_me_root

CACHE_STORE=database
QUEUE_CONNECTION=sync
SESSION_DRIVER=database
FILESYSTEM_DISK=local

WEB_PORT=8080
WEB_BIND_IP=127.0.0.1
```

For this EC2 setup, `.env.ec2` is the source of truth for runtime configuration because `docker-compose.ec2.yml` injects those values directly into the containers.

On first workflow deploy, the server also creates `app/.env` automatically from `app/.env.example` if it does not exist.

If you want `app/.env` present and aligned for manual work inside the checkout, these are the important values:

```dotenv
APP_ENV=testing
APP_DEBUG=false
APP_URL=http://test.example.com
APP_KEY=base64:...

DB_CONNECTION=mysql
DB_HOST=mysql
DB_PORT=3306
DB_DATABASE=gilba
DB_USERNAME=gilba
DB_PASSWORD=change_me

SESSION_DRIVER=database
CACHE_STORE=database
QUEUE_CONNECTION=sync
FILESYSTEM_DISK=local
```

Generate the app key once:

```bash
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml up -d --build
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml exec app php artisan key:generate
```

Copy the generated `APP_KEY` into `.env.ec2` so the container always starts with the same key.

## Deploy flow from GitHub

The workflow in [.github/workflows/deploy-test-ec2.yml](/Users/yury/work/gilba/.github/workflows/deploy-test-ec2.yml) does this:

1. SSH into the EC2 instance.
2. Packages the checked-out GitHub Actions workspace as a tarball.
3. Uploads the release tarball to the server.
4. Creates `app/.env` from the example file if needed.
5. Run `docker compose up -d --build`.
6. Run `composer install`, `php artisan migrate --force`, `npm ci`, and `npm run build`.
7. Refresh Laravel caches.

Add these GitHub repository secrets:

- `EC2_HOST`
- `EC2_USER`
- `EC2_SSH_KEY`
- `EC2_APP_DIR`

Recommended `EC2_APP_DIR`:

```text
/srv/gilba
```

## Day-one deploy commands

If you want to deploy manually before enabling GitHub Actions:

```bash
cd /srv/gilba
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml up -d --build
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml exec app composer install --no-dev --optimize-autoloader
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml exec app php artisan migrate --force
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml exec app npm ci
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml exec app npm run build
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml exec app php artisan optimize:clear
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml exec app php artisan config:cache
```

## TLS for a test domain

Keep TLS off the containers. For a simple test setup:

- Bind the container nginx to `127.0.0.1:8080`
- Install host nginx on EC2
- Use Certbot on the host
- Reverse proxy `443 -> 127.0.0.1:8080`
- Redirect `80 -> 443`

That keeps certificate management out of Docker and avoids changing the app containers.

Use this in `.env.ec2`:

```dotenv
WEB_PORT=8080
WEB_BIND_IP=127.0.0.1
```

Install host nginx and Certbot:

```bash
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo systemctl enable --now nginx
```

Create an nginx site config at `/etc/nginx/sites-available/gilba-test`:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name test.example.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name test.example.com;

    ssl_certificate /etc/letsencrypt/live/test.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/test.example.com/privkey.pem;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 300;
    }
}
```

Enable the site:

```bash
sudo mkdir -p /var/www/certbot
sudo ln -sf /etc/nginx/sites-available/gilba-test /etc/nginx/sites-enabled/gilba-test
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Make sure your DNS already points `test.example.com` to the EC2 public IP, then request the certificate:

```bash
sudo certbot --nginx -d test.example.com
```

Certbot will update the nginx config to use the issued certificate and will install automatic renewal via systemd timer on Ubuntu.

After TLS is live, set these Laravel values so generated URLs and secure cookies are correct:

In `.env.ec2`:

```dotenv
APP_URL=https://test.example.com
```

In `app/.env`:

```dotenv
APP_URL=https://test.example.com
SESSION_SECURE_COOKIE=true
```

Then refresh Laravel config:

```bash
cd /srv/gilba
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml exec app php artisan optimize:clear
docker compose --env-file .env.ec2 -f docker-compose.ec2.yml exec app php artisan config:cache
```

## Known limitations of this test setup

- MySQL runs on the same EC2 host, so DB loss and app loss are coupled.
- Uploads remain on local disk under `app/storage`, which is acceptable for test but not durable enough for real environments.
- Deploys run `composer` and `npm` on the host during each rollout, so deployments are slower than image-based production pipelines.
- The GitHub workflow extracts a release tarball into the app directory, so files deleted in Git may need occasional manual cleanup on the server.

## When to upgrade this setup

Move beyond single EC2 when any of these become true:

- the test environment becomes important enough to require reliable backups
- multiple people depend on it daily
- you need isolated staging and production
- queue workers or scheduled jobs become operationally important
- user-uploaded files need durable storage
