# 🚀 GitHub Actions - Configuración de CI/CD

Esta guía te ayudará a configurar la GitHub Action para build automático, push a Docker registries y deploy por SSH.

## 📋 ¿Qué hace la GitHub Action?

1. **🏗️ Build**: Construye la imagen Docker con cache optimizado
2. **📤 Push**: Sube la imagen a GitHub Container Registry y Docker Hub
3. **🚀 Deploy**: Se conecta por SSH al servidor y ejecuta comandos de deploy
4. **📧 Notify**: Notifica el resultado del deployment

## 🔧 Configuración de Secrets

Ve a tu repositorio en GitHub → **Settings** → **Secrets and variables** → **Actions** y agrega estos secrets:

### 🐳 Docker Hub (Opcional)
```
DOCKERHUB_USERNAME=tu_usuario_dockerhub
DOCKERHUB_TOKEN=tu_token_dockerhub
```

**Cómo obtener el token:**
1. Ve a [Docker Hub](https://hub.docker.com/)
2. Login → Account Settings → Security → New Access Token
3. Crea un token con permisos de **Read, Write, Delete**

### 🖥️ Servidor SSH (Requerido)
```
SERVER_HOST=tu_servidor.com (o IP)
SERVER_USER=ubuntu (o tu usuario)
SERVER_SSH_KEY=-----BEGIN OPENSSH PRIVATE KEY-----...
SERVER_PORT=22 (opcional, por defecto 22)
SERVER_PROJECT_PATH=/home/ubuntu/arceliuz (opcional)
```

**Cómo obtener la SSH Key:**
```bash
# En tu máquina local, generar clave SSH (si no tienes)
ssh-keygen -t ed25519 -C "github-actions@tu-repo"

# Copiar la clave pública al servidor
ssh-copy-id -i ~/.ssh/id_ed25519.pub usuario@tu-servidor.com

# Obtener la clave privada para GitHub Secrets
cat ~/.ssh/id_ed25519
```

### 📊 Resumen de Secrets Requeridos

| Secret | Requerido | Descripción |
|--------|-----------|-------------|
| `DOCKERHUB_USERNAME` | ❌ | Usuario de Docker Hub |
| `DOCKERHUB_TOKEN` | ❌ | Token de acceso de Docker Hub |
| `SERVER_HOST` | ✅ | IP o dominio del servidor |
| `SERVER_USER` | ✅ | Usuario SSH del servidor |
| `SERVER_SSH_KEY` | ✅ | Clave SSH privada |
| `SERVER_PORT` | ❌ | Puerto SSH (default: 22) |
| `SERVER_PROJECT_PATH` | ❌ | Ruta del proyecto en el servidor |

## 🐳 Configuración del Servidor

### 1. Instalar Docker y Docker Compose

```bash
# Actualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Agregar usuario al grupo docker
sudo usermod -aG docker $USER

# Instalar Docker Compose
sudo apt install docker-compose-plugin -y

# Verificar instalación
docker --version
docker compose version
```

### 2. Crear estructura del proyecto

```bash
# Crear directorio del proyecto
mkdir -p /home/ubuntu/arceliuz
cd /home/ubuntu/arceliuz

# Clonar repositorio (opcional, si quieres código también)
git clone https://github.com/PedroPab/Arceliuz.git .

# Crear docker-compose.yml para producción
```

### 3. Ejemplo de docker-compose.yml para el servidor

Crea este archivo en tu servidor en `/home/ubuntu/arceliuz/docker-compose.yml`:

```yaml
version: '3.8'

services:
  arceliuz:
    image: ghcr.io/pedropab/arceliuz:latest
    # o: tu_usuario_dockerhub/arceliuz:latest
    container_name: arceliuz-app
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - PORT=8080
    volumes:
      - ./logs:/app/logs
      - ./uploads:/app/uploads
    networks:
      - arceliuz-network

  # Agregar otros servicios si necesitas (nginx, db, etc)
  # nginx:
  #   image: nginx:alpine
  #   ports:
  #     - "80:80"
  #     - "443:443"
  #   volumes:
  #     - ./nginx.conf:/etc/nginx/nginx.conf
  #   depends_on:
  #     - arceliuz

networks:
  arceliuz-network:
    driver: bridge

volumes:
  logs:
  uploads:
```

## 🔄 Flujo de Deploy

Cuando hagas push a `main`:

1. **Build** → Construye imagen Docker multi-arquitectura
2. **Push** → Sube a GitHub Container Registry (y Docker Hub si está configurado)
3. **SSH** → Se conecta al servidor
4. **Pull** → Descarga la nueva imagen
5. **Deploy** → Recrea contenedores con `docker-compose up -d`
6. **Cleanup** → Limpia imágenes antiguas
7. **Verify** → Verifica que todo funcione

## 🧪 Probar la GitHub Action

### 1. Ejecución manual
- Ve a tu repo → **Actions** → **Build, Push and Deploy to Server**
- Click en **Run workflow** → **Run workflow**

### 2. Push a main
```bash
git add .
git commit -m "test: trigger github action"
git push origin main
```

### 3. Monitorear logs
- Ve a **Actions** en tu repositorio
- Click en el workflow en ejecución
- Revisa los logs de cada job

## 🚨 Solución de Problemas

### Error de SSH
```bash
# Verificar conexión SSH manualmente
ssh -i ~/.ssh/id_ed25519 usuario@servidor.com

# Verificar que la clave esté en formato correcto
cat ~/.ssh/id_ed25519 | head -1
# Debe empezar con: -----BEGIN OPENSSH PRIVATE KEY-----
```

### Error de Docker
```bash
# En el servidor, verificar Docker
sudo systemctl status docker
docker info

# Verificar permisos
groups $USER
# Debe incluir 'docker'
```

### Error de permisos de directorio
```bash
# En el servidor, verificar permisos
ls -la /home/ubuntu/
sudo chown -R ubuntu:ubuntu /home/ubuntu/arceliuz
```

### Ver logs del deployment
```bash
# En el servidor
docker-compose logs -f arceliuz
```

## 📝 Personalizar Comandos

Puedes modificar la sección `script:` en `.github/workflows/docker-build.yml` para ejecutar comandos específicos:

```yaml
script: |
  echo "🔄 Custom deployment commands..."
  
  # Tus comandos personalizados aquí
  cd /ruta/a/tu/proyecto
  
  # Backup de base de datos
  docker-compose exec db pg_dump ... > backup.sql
  
  # Ejecutar migraciones
  docker-compose exec app npm run migrate
  
  # Reiniciar servicios específicos
  docker-compose restart nginx
  
  # Enviar notificación
  curl -X POST "https://hooks.slack.com/..." -d '{"text":"Deploy completed"}'
```

## 🎯 Próximos Pasos

1. ✅ Configurar todos los secrets necesarios
2. ✅ Preparar el servidor con Docker
3. ✅ Crear docker-compose.yml en el servidor
4. ✅ Hacer un push de prueba a main
5. ✅ Monitorear el primer deployment

¡Tu pipeline de CI/CD estará listo! 🚀