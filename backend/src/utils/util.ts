import { differenceInSeconds, format, parse, parseISO } from "date-fns";

export const formatDateToMySQL = (dateStrIn: string): string => {
  const dateStr = dateStrIn;
  const date = new Date(dateStr);

  // Helper function to pad single digit numbers with leading zero
  const pad = (number, digits = 2) => String(number).padStart(digits, "0");

  // Formatting the date
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1); // Months are zero-based
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  const milliseconds = pad(date.getMilliseconds(), 6); // Pad to 6 digits

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
};

export const getDiffHoursWithBetweenDates = (
  dateStart: string,
  dateEnd: string
): number => {
  const givenDate = new Date(dateStart);
  const givenDateEnd = new Date(dateEnd);

  // Convert both dates to milliseconds
  const givenTime = givenDate.getTime();
  const currentTime = givenDateEnd.getTime();

  // Calculate the difference in milliseconds
  const differenceInMillis = currentTime - givenTime;

  // Convert milliseconds to hours
  const differenceInHours = differenceInMillis / (1000 * 60 * 60);

  return differenceInHours;
};

export const currentDate = (formatDate = "yyyy-MM-dd HH:mm:ss.SSS"): string => {
  return format(new Date(), formatDate);
};

export const formatDate = (
  fecha: string,
  formatDateIn = "yyyy-MM-dd HH:mm:ss.SSS"
): string => {
  return format(new Date(fecha), formatDateIn);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export const agruparFechas = (fechas: any[]) => {
  // Primero, contemos las fechas usando reduce
  const conteo = fechas.reduce((acc, fecha) => {
    if (!acc[fecha]) {
      acc[fecha] = 0;
    }
    acc[fecha] += 1;
    return acc;
  }, {});

  // Luego, transformemos el objeto de conteo en una lista de objetos
  return Object.keys(conteo).map(fecha => ({
    date: fecha,
    count: conteo[fecha]
  }));
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
export const agruparPorPropiedad = (lista: any[], propiedad: string) => {
  return lista.reduce((acc, obj) => {
    const clave = obj[propiedad];
    if (!acc[clave]) {
      acc[clave] = [];
    }
    acc[clave].push(obj);
    return acc;
  }, {});
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const differenceInSecondsByTimestamps = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
  timeStampFinal: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/explicit-module-boundary-types
  timeStampIncial: any
) => {
  return differenceInSeconds(
    new Date(timeStampFinal * 1000),
    new Date(timeStampIncial * 1000)
  );
};

export const SPECIAL_CHAT_MESSAGE_AUTOMATIC = "\u200E";

export const textoNoStardWithAutomatic = texto =>
  !texto.startsWith(
    String.fromCharCode(parseInt(SPECIAL_CHAT_MESSAGE_AUTOMATIC, 16))
  );

// Función para generar todas las fechas entre dos fechas
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const generateDateByRange = (fechaInicio, fechaFin) => {
  const fechas = [];
  const currentdate = new Date(fechaInicio);
  const currentdatefin = new Date(fechaFin);
  while (currentdate <= currentdatefin) {
    fechas.push({ date: new Date(currentdate), count: 0 });
    currentdate.setDate(currentdate.getDate() + 1);
  }
  return fechas;
};

// Función para generar todas las horas entre dos fechas
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const generateHours = fecha => {
  const horas = [];
  // eslint-disable-next-line no-plusplus
  for (let i = 0; i < 24; i++) {
    const hora = new Date(fecha);
    hora.setUTCHours(i, 0, 0, 0);
    horas.push({ date: hora, count: 0 });
  }
  return horas;
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const convertDateStrToTimestamp = fechaStr => {
  // Parsear la fecha utilizando el formato especificado
  const fecha = new Date(fechaStr);
  // Obtener el timestamp
  const timestamp = Math.floor(fecha.getTime() / 1000);
  return timestamp;
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const groupDateWithRange = (
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  fechaInicio: any,
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  fechaFin: any,
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  fechas: any[]
) => {
  let datesGenerate: any[] = [];
  let formatDates = "yyyy-MM-dd";
  if (
    formatDate(fechaInicio, "yyyy-MM-dd") === formatDate(fechaFin, "yyyy-MM-dd")
  ) {
    datesGenerate = generateHours(fechaInicio);
    formatDates = "HH";
  } else {
    datesGenerate = generateDateByRange(fechaInicio, fechaFin);
  }
  // Primero, contemos las fechas usando reduce
  const conteo = fechas.reduce((acc, fecha) => {
    fecha = formatDate(fecha, formatDates);
    if (!acc[fecha]) {
      acc[fecha] = 0;
    }
    acc[fecha] += 1;
    return acc;
  }, {});
  // Luego, transformemos el objeto de conteo en una lista de objetos
  const fechaEncontradas = Object.keys(conteo).map(fecha => ({
    date: fecha,
    count: conteo[fecha]
  }));
  // Añadir fechas faltantes con count 0
  datesGenerate.forEach((fechaG: any) => {
    fechaG.date = format(fechaG.date, formatDates);
    const index = fechaEncontradas.findIndex(_f => _f.date === fechaG.date);
    if (index !== -1) {
      fechaG.count = fechaEncontradas[index].count;
    }
  });
  datesGenerate.sort((a, b) => a.date - b.date);
  return datesGenerate;
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
export const isMessageClient = (message: any, whatasappListIDS: any[]) => {
  return (
    message?.misPrivate !== 1 &&
    message?.mfromMe !== 1 &&
    message?.misCompanyMember !== 1 &&
    !message?.cmnumber?.includes(whatasappListIDS)
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
export const isMessageNotClient = (message: any, whatasappListIDS: any[]) => {
  return (
    textoNoStardWithAutomatic(message?.body) &&
    message?.misPrivate !== 1 &&
    (message?.mfromMe === 1 ||
      message?.misCompanyMember === 1 ||
      message?.cmnumber?.includes(whatasappListIDS))
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
export const processMessageTicketClosed = (
  messageList: any[],
  whatasappListIDS: any[]
) => {
  const times = {
    firstResponse: null,
    avgResponse: null,
    resolution: null,
    waiting: null,
    quintalHours: null
  };
  let isValidate = true;
  if (messageList.length === 1 && messageList[0].mid === null) {
    isValidate = false;
  }

  if (isValidate) {
    /**
     * Ordenos los mensajes por timestamp
     */
    messageList.sort((a, b) => a.timestamp - b.timestamp);
    const firstMessageTicketTimeStamp = messageList[0].timestamp;
    const lastMessageTicketTimeStamp =
      messageList[messageList.length - 1].timestamp;
    if (!!firstMessageTicketTimeStamp && !!lastMessageTicketTimeStamp) {
      times.resolution =
        differenceInSeconds(
          new Date(firstMessageTicketTimeStamp * 1000),
          new Date(lastMessageTicketTimeStamp * 1000)
        ) / 3600;
    }
    const responseTimes = [];
    let lastSenderMessageTime = null;
    // eslint-disable-next-line no-restricted-syntax
    for (const message of messageList) {
      if (isMessageClient(message, whatasappListIDS)) {
        lastSenderMessageTime = message.timestamp;
      } else if (
        isMessageNotClient(message, whatasappListIDS) &&
        lastSenderMessageTime
      ) {
        // Calcular el tiempo de respuesta y añadirlo al array
        const responseTime = message.timestamp - lastSenderMessageTime;
        if (times.firstResponse === null) {
          times.firstResponse = responseTime / 60;
        }
        responseTimes.push(responseTime);
        lastSenderMessageTime = null; // Reset para el próximo par de mensajes
      }
    }

    // Calcular el tiempo de respuesta promedio
    if (responseTimes.length > 0) {
      times.avgResponse =
        responseTimes.reduce((acc, time) => acc + time, 0) /
        responseTimes.length /
        3600;
    }
  }
  return times;
};

export const processMessageTicketPendingOrOpen = (
  messageList: any[],
  whatasappListIDS: any[]
) => {
  const times = {
    firstResponse: null,
    avgResponse: null,
    resolution: null,
    waiting: null,
    quintalHours: null
  };
  let isValidate = true;
  if (messageList.length === 1 && messageList[0].mid === null) {
    isValidate = false;
  }

  if (isValidate) {
    /**
     * Ordenos los mensajes por timestamp
     */
    messageList.sort((a, b) => a.timestamp - b.timestamp);
    const firstMessageTicketTimeStamp = messageList[0].timestamp;
    const lastMessageTicketTimeStamp =
      messageList[messageList.length - 1].timestamp;
    if (!!firstMessageTicketTimeStamp && !!lastMessageTicketTimeStamp) {
      times.resolution =
        differenceInSeconds(
          new Date(firstMessageTicketTimeStamp * 1000),
          new Date(lastMessageTicketTimeStamp * 1000)
        ) / 3600;
    }
  }
  return times;
};
