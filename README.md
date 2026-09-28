# CRUD Serverless de Reservas — Laboratorio 3 Cloud Computing (UdeA 2026)

API REST 100 % serverless para administrar **reservas**, construida con AWS Lambda, API Gateway (HTTP API) y Amazon DynamoDB, definida como infraestructura como código con Serverless Framework v4.

```
Cliente (Postman) → API Gateway (HTTP API) → AWS Lambda (5 funciones) → DynamoDB (1 tabla)
                                                    └→ CloudWatch Logs
```

## Entidad: Reserva

| Atributo      | Tipo   | Obligatorio | Regla                                         |
|---------------|--------|-------------|-----------------------------------------------|
| `id`          | String | auto        | UUID generado en el servidor (partition key)  |
| `cliente`     | String | sí          | Texto no vacío                                |
| `servicio`    | String | sí          | Texto no vacío                                |
| `fecha`       | String | sí          | `YYYY-MM-DD`                                  |
| `hora`        | String | sí          | `HH:MM` (24 h)                                |
| `personas`    | Number | sí          | Entero ≥ 1                                    |
| `estado`      | String | no          | `pendiente` (por defecto), `confirmada`, `cancelada` |
| `creadoEn`    | String | auto        | ISO 8601                                      |
| `actualizadoEn` | String | auto      | ISO 8601 (solo tras un PUT)                   |

## Endpoints

| Método | Ruta              | Función      | Respuestas                  |
|--------|-------------------|--------------|-----------------------------|
| POST   | `/reservas`       | `crear`      | 201 · 400 · 500             |
| GET    | `/reservas`       | `listar`     | 200 · 500                   |
| GET    | `/reservas/{id}`  | `obtener`    | 200 · 404 · 500             |
| PUT    | `/reservas/{id}`  | `actualizar` | 200 · 400 · 404 · 500       |
| DELETE | `/reservas/{id}`  | `eliminar`   | 200 · 404 · 500             |

`actualizar` y `eliminar` usan `ConditionExpression: "attribute_exists(id)"`; si el id no existe, DynamoDB lanza `ConditionalCheckFailedException` y la API responde **404** (sin esto, `UpdateCommand` crearía un registro nuevo y `DeleteCommand` no haría nada).

## Requisitos

- Node.js 20 o superior
- Serverless Framework v4: `npm install -g serverless`
- Cuenta en [app.serverless.com](https://app.serverless.com) y cuenta de AWS con credenciales configuradas (`aws configure` o proveedor conectado en el dashboard)

## Instalación

```bash
git clone <URL-del-repositorio>
cd crud-reservas
npm install
```

> Cambiar `org` en `serverless.yml` por la organización propia de app.serverless.com.

## Despliegue en AWS

```bash
serverless deploy
```

Al terminar se imprimen las URLs, por ejemplo `https://abcd1234.execute-api.us-east-1.amazonaws.com/reservas`.

Recursos creados (stage `dev`):
- 5 funciones Lambda: `crud-reservas-dev-crear`, `-listar`, `-obtener`, `-actualizar`, `-eliminar`
- HTTP API con las 5 rutas
- Tabla DynamoDB `crud-reservas-reservas-dev` (partition key `id`, modo bajo demanda)
- Pila CloudFormation `crud-reservas-dev`

## Pruebas locales

El modo offline usa la tabla real de AWS, así que primero se despliega y luego:

```bash
serverless offline
```

La API queda en `http://localhost:3000`.

```http
POST http://localhost:3000/reservas
Content-Type: application/json

{
  "cliente": "Daniela Vela",
  "servicio": "Mesa terraza",
  "fecha": "2026-10-15",
  "hora": "19:30",
  "personas": 4
}
```

## Pruebas con Postman

1. Importar `postman/crud-reservas.postman_collection.json`.
2. En las variables de la colección, `baseUrl` = `http://localhost:3000` (local) o la URL de AWS.
3. Ejecutar la carpeta **Casos exitosos** en orden: el request *Crear* guarda automáticamente el `id` para los demás.
4. Ejecutar la carpeta **Casos de error** (400 y 404).

Cada request trae un test que verifica el código HTTP esperado, así que se puede correr todo con el *Collection Runner*.

## Verificación en la consola de AWS

- **Lambda**: las 5 funciones y la variable de entorno `RESERVAS_TABLE`.
- **API Gateway**: la HTTP API con las 5 rutas.
- **DynamoDB** → *Explorar elementos*: los datos cambian tras cada operación.
- **CloudWatch Logs**: grupos `/aws/lambda/crud-reservas-dev-*`.

## Limpieza

```bash
serverless remove
```

## Estructura

```
crud-reservas/
├── handler.js          # Lógica de las 5 funciones
├── serverless.yml      # Funciones, rutas, tabla, IAM
├── package.json
├── postman/
│   └── crud-reservas.postman_collection.json
└── README.md
```
