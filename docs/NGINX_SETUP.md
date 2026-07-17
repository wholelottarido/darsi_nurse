# NGINX Setup

## Status Repo

Repo ini tidak menyertakan file konfigurasi Nginx aktif. Konfigurasi di bawah adalah template deploy berdasarkan pola runtime repo saat ini.

## Port Backend

Pilih salah satu:

- `3019` jika backend dijalankan dengan `npm run start`
- `6767` jika backend dijalankan dengan `ecosystem.config.js`

Contoh di bawah memakai `6767` karena itu yang dipakai PM2 saat ini.

## Contoh Konfigurasi

```nginx
server {
    listen 80;
    server_name <DOMAIN_OR_IP>;

    access_log /var/log/nginx/darsi-nurse.access.log;
    error_log /var/log/nginx/darsi-nurse.error.log;

    location / {
        proxy_pass http://127.0.0.1:6767;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_read_timeout 300;
        proxy_connect_timeout 60;
        proxy_send_timeout 300;
    }
}
```

## Aktivasi

```bash
sudo cp <FILE_CONF> /etc/nginx/sites-available/darsi-nurse
sudo ln -s /etc/nginx/sites-available/darsi-nurse /etc/nginx/sites-enabled/darsi-nurse
sudo nginx -t
sudo systemctl reload nginx
sudo systemctl status nginx
```

## HTTPS

Jika memakai domain public, tambahkan TLS dengan Certbot atau reverse proxy yang setara. Repo ini tidak memaksa HTTPS, tetapi cookie `secure` akan aktif saat `NODE_ENV=production`.

## Hostname dan Domain yang Muncul di Repo

- `darsi.nrs.hcm-lab.id`
- `darsi.ph.hcm-lab.id`

Nilai tersebut berasal dari source lama dan harus direview saat pindah VM/domain.
