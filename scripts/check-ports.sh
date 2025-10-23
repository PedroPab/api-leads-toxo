#!/bin/bash

echo "🔍 Diagnosticando puertos y conectividad..."
echo "=================================="

# Verificar si Docker está ejecutándose
if ! docker ps >/dev/null 2>&1; then
    echo "❌ Docker no está ejecutándose"
    exit 1
fi

echo "✅ Docker está ejecutándose"

# Verificar contenedores en ejecución
echo ""
echo "📦 Contenedores en ejecución:"
docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"

# Verificar puertos en uso en el host
echo ""
echo "🔌 Puertos en uso en el host:"
echo "Puerto 3000 (API):"
if lsof -i :3000 >/dev/null 2>&1; then
    lsof -i :3000
else
    echo "❌ Puerto 3000 no está en uso"
fi

echo ""
echo "Puerto 6379 (Redis):"
if lsof -i :6379 >/dev/null 2>&1; then
    lsof -i :6379
else
    echo "❌ Puerto 6379 no está en uso"
fi

# Verificar conectividad interna de Docker
echo ""
echo "🔗 Verificando conectividad interna:"

API_CONTAINER=$(docker ps -q --filter "name=api-leads-toxo")
if [ -n "$API_CONTAINER" ]; then
    echo "✅ Contenedor API encontrado: $API_CONTAINER"
    
    # Verificar si la aplicación está respondiendo internamente
    echo "🔍 Verificando respuesta interna del contenedor API..."
    docker exec $API_CONTAINER curl -s http://localhost:3000 >/dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ API responde internamente"
    else
        echo "❌ API no responde internamente"
        echo "📋 Logs del contenedor API:"
        docker logs --tail 10 $API_CONTAINER
    fi
else
    echo "❌ Contenedor API no encontrado"
fi

# Verificar conectividad externa
echo ""
echo "🌐 Verificando conectividad externa:"
if curl -s http://localhost:3000 >/dev/null 2>&1; then
    echo "✅ API accesible desde el host en http://localhost:3000"
else
    echo "❌ API no accesible desde el host"
fi

# Verificar redes de Docker
echo ""
echo "🔗 Redes de Docker:"
docker network ls

# Verificar configuración de red del contenedor API
if [ -n "$API_CONTAINER" ]; then
    echo ""
    echo "📋 Configuración de red del contenedor API:"
    docker inspect $API_CONTAINER | jq '.[0].NetworkSettings.Networks'
fi

echo ""
echo "🚀 Comandos útiles para debugging:"
echo "  - Ver logs de API: docker logs -f $API_CONTAINER"
echo "  - Ejecutar shell en API: docker exec -it $API_CONTAINER sh"
echo "  - Reiniciar servicios: docker-compose restart"
echo "  - Verificar puerto manualmente: curl http://localhost:3000"