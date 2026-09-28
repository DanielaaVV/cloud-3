const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  ScanCommand,
  UpdateCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");
const { randomUUID } = require("crypto");

const TABLE = process.env.RESERVAS_TABLE;
// Cliente creado fuera de los handlers para reutilizarlo entre invocaciones
const db = DynamoDBDocumentClient.from(new DynamoDBClient());

const ESTADOS = ["pendiente", "confirmada", "cancelada"];

const respuesta = (statusCode, body) => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const leerBody = (event) => {
  try {
    return JSON.parse(event.body || "{}");
  } catch {
    return null;
  }
};

const esFechaValida = (s) =>
  typeof s === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !isNaN(Date.parse(s));

const esHoraValida = (s) =>
  typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

const validar = (data) => {
  if (!data || typeof data !== "object" || Array.isArray(data))
    return "El cuerpo debe ser un JSON válido";
  if (typeof data.cliente !== "string" || !data.cliente.trim())
    return '"cliente" es obligatorio y debe ser texto';
  if (typeof data.servicio !== "string" || !data.servicio.trim())
    return '"servicio" es obligatorio y debe ser texto';
  if (!esFechaValida(data.fecha))
    return '"fecha" es obligatoria con formato YYYY-MM-DD';
  if (!esHoraValida(data.hora))
    return '"hora" es obligatoria con formato HH:MM (24 h)';
  if (!Number.isInteger(data.personas) || data.personas < 1)
    return '"personas" es obligatorio y debe ser un entero >= 1';
  if (data.estado !== undefined && !ESTADOS.includes(data.estado))
    return `"estado" debe ser uno de: ${ESTADOS.join(", ")}`;
  return null;
};

const esNoExiste = (err) => err.name === "ConditionalCheckFailedException";

// CREATE - POST /reservas
module.exports.crear = async (event) => {
  const data = leerBody(event);
  const error = validar(data);
  if (error) return respuesta(400, { error });

  const item = {
    id: randomUUID(),
    cliente: data.cliente.trim(),
    servicio: data.servicio.trim(),
    fecha: data.fecha,
    hora: data.hora,
    personas: data.personas,
    estado: data.estado ?? "pendiente",
    creadoEn: new Date().toISOString(),
  };

  try {
    await db.send(new PutCommand({ TableName: TABLE, Item: item }));
    return respuesta(201, item);
  } catch (err) {
    console.error(err);
    return respuesta(500, { error: "No fue posible crear la reserva" });
  }
};

// READ (todos) - GET /reservas
module.exports.listar = async () => {
  try {
    const { Items } = await db.send(new ScanCommand({ TableName: TABLE }));
    return respuesta(200, Items);
  } catch (err) {
    console.error(err);
    return respuesta(500, { error: "No fue posible listar las reservas" });
  }
};

// READ (uno) - GET /reservas/{id}
module.exports.obtener = async (event) => {
  const { id } = event.pathParameters;
  try {
    const { Item } = await db.send(
      new GetCommand({ TableName: TABLE, Key: { id } })
    );
    if (!Item) return respuesta(404, { error: "Reserva no encontrada" });
    return respuesta(200, Item);
  } catch (err) {
    console.error(err);
    return respuesta(500, { error: "No fue posible consultar la reserva" });
  }
};

// UPDATE - PUT /reservas/{id}
module.exports.actualizar = async (event) => {
  const { id } = event.pathParameters;
  const data = leerBody(event);
  const error = validar(data);
  if (error) return respuesta(400, { error });

  const campos = {
    cliente: data.cliente.trim(),
    servicio: data.servicio.trim(),
    fecha: data.fecha,
    hora: data.hora,
    personas: data.personas,
    estado: data.estado ?? "pendiente",
    actualizadoEn: new Date().toISOString(),
  };

  // Se usan alias (#campo) para todos los atributos: así no hay problema
  // si alguno coincide con una palabra reservada de DynamoDB.
  const sets = [];
  const names = {};
  const values = {};
  for (const [k, v] of Object.entries(campos)) {
    sets.push(`#${k} = :${k}`);
    names[`#${k}`] = k;
    values[`:${k}`] = v;
  }

  try {
    const { Attributes } = await db.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { id },
        UpdateExpression: `SET ${sets.join(", ")}`,
        ConditionExpression: "attribute_exists(id)",
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ReturnValues: "ALL_NEW",
      })
    );
    return respuesta(200, Attributes);
  } catch (err) {
    if (esNoExiste(err))
      return respuesta(404, { error: "Reserva no encontrada" });
    console.error(err);
    return respuesta(500, { error: "No fue posible actualizar la reserva" });
  }
};

// DELETE - DELETE /reservas/{id}
module.exports.eliminar = async (event) => {
  const { id } = event.pathParameters;
  try {
    await db.send(
      new DeleteCommand({
        TableName: TABLE,
        Key: { id },
        ConditionExpression: "attribute_exists(id)",
      })
    );
    return respuesta(200, { mensaje: `Reserva ${id} eliminada correctamente` });
  } catch (err) {
    if (esNoExiste(err))
      return respuesta(404, { error: "Reserva no encontrada" });
    console.error(err);
    return respuesta(500, { error: "No fue posible eliminar la reserva" });
  }
};
