import { differenceInSeconds, format } from "date-fns";

export const formatDateToMySQL = (dateStrIn: string): string => {
  const dateStr = dateStrIn;
  const date = new Date(dateStr);

  // Obtener el desfase horario de la fecha (en horas ejem: -5)
  const dateTzHours = (date.getTimezoneOffset() / 60) * -1;

  // y ajustamos para convertirlo a -3 (esto por el problema de la confi inizial de sequealize)
  date.setHours(date.getHours() + (-3 - dateTzHours));

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
  texto !== null &&
  texto !== "" &&
  !texto.startsWith(SPECIAL_CHAT_MESSAGE_AUTOMATIC);

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
export const secondsToDhms = seconds => {
  const h = seconds / 3600;
  return `${h}`;

  // // const d = Math.floor(seconds / (3600 * 24));
  // const h = Math.floor(seconds / 3600);
  // const m = Math.floor((seconds % 3600) / 60);
  // // eslint-disable-next-line radix
  // const s = parseInt((seconds % 60).toString());

  // // const dTxt = d < 10 ? `0${d}` : d;
  // const hTxt = h < 10 ? `0${h}` : h;
  // const mTxt = m < 10 ? `0${m}` : m;
  // const sTxt = s < 10 ? `0${s}` : s;
  // // if (d > 0) {
  // //   return `${dTxt} dias ${hTxt}:${mTxt}:${sTxt}`;
  // // }
  // return `${hTxt}:${mTxt}:${sTxt}`;
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
    textoNoStardWithAutomatic(message?.mbody) &&
    message?.misPrivate !== 1 &&
    (message?.mfromMe === 1 ||
      message?.misCompanyMember === 1 ||
      message?.cmnumber?.includes(whatasappListIDS))
  );
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types, @typescript-eslint/no-explicit-any
export const processMessageTicketClosed = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messageList: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  whatasappListIDS: any[]
) => {
  const times = {
    firstResponse: null,
    avgResponse: null,
    resolution: null,
    waiting: null,
    quintalHours: null,
    firstResponseMessage: null
  };
  let isValidate = true;
  if (messageList.length === 1 && messageList[0].mid === null) {
    isValidate = false;
  }

  if (isValidate) {
    /**
     * Ordenos los mensajes por timestamp
     */
    messageList.sort((a, b) => a.mtimestamp - b.mtimestamp);
    const firstMessageTicketTimeStamp = messageList[0].mtimestamp;
    const lastMessageTicketTimeStamp =
      messageList[messageList.length - 1].mtimestamp;
    if (
      firstMessageTicketTimeStamp !== null &&
      lastMessageTicketTimeStamp !== null
    ) {
      times.resolution = differenceInSeconds(
        new Date(lastMessageTicketTimeStamp * 1000),
        new Date(firstMessageTicketTimeStamp * 1000)
      );
    }
    const responseTimes = [];
    let lastSenderMessageTime = null;
    // eslint-disable-next-line no-restricted-syntax
    for (const message of messageList) {
      if (isMessageClient(message, whatasappListIDS)) {
        if (lastSenderMessageTime === null) {
          lastSenderMessageTime = message.mtimestamp;
        }
      } else if (
        isMessageNotClient(message, whatasappListIDS) &&
        lastSenderMessageTime
      ) {
        // Calcular el tiempo de respuesta y añadirlo al array
        const responseTime = differenceInSeconds(
          new Date(message.mtimestamp * 1000),
          new Date(lastSenderMessageTime * 1000)
        );
        if (times.firstResponse === null) {
          times.firstResponse = secondsToDhms(
            differenceInSeconds(
              new Date(message.mtimestamp * 1000),
              new Date(lastSenderMessageTime * 1000)
            )
          );
          times.firstResponseMessage = message.mbody;
        }
        responseTimes.push(responseTime);
        lastSenderMessageTime = null; // Reset para el próximo par de mensajes
      }
    }

    // Calcular el tiempo de respuesta promedio
    if (responseTimes.length > 0) {
      times.avgResponse =
        responseTimes.reduce((acc, time) => acc + time, 0) /
        responseTimes.length;
      times.avgResponse = secondsToDhms(times.avgResponse);
    }
  }
  return times;
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const processMessageTicketPendingOrOpen = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messageList: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  whatasappListIDS: any[]
) => {
  const times = {
    firstResponse: null,
    avgResponse: null,
    resolution: null,
    waiting: null,
    quintalHours: null,
    firstResponseMessage: null
  };
  let isValidate = true;
  if (messageList.length === 1 && messageList[0].mid === null) {
    isValidate = false;
  }

  if (isValidate) {
    /**
     * Ordenos los mensajes por timestamp
     */
    /**
     * Ordenos los mensajes por timestamp
     */
    messageList.sort((a, b) => a.mtimestamp - b.mtimestamp);
    const responseTimes = [];
    let lastSenderMessageTime = null;

    const firstMessage = messageList[0];

    if (isMessageNotClient(firstMessage, whatasappListIDS)) {
      const firstClientMessageIndex = messageList.findIndex(message => {
        if (isMessageClient(message, whatasappListIDS)) {
          lastSenderMessageTime = message.mtimestamp;
          return true;
        }
      });

      if (firstClientMessageIndex > -1) {
        messageList = messageList.slice(firstClientMessageIndex);
      }
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const message of messageList) {
      // if (message.tid === 549) {
      //   console.log("---MEENSAJE: ", message);
      // }

      if (isMessageClient(message, whatasappListIDS)) {
        // if (message.tid === 549) {
        //   console.log("____isMessageClient");
        // }

        if (lastSenderMessageTime === null) {
          lastSenderMessageTime = message.mtimestamp;
        }
      } else if (
        isMessageNotClient(message, whatasappListIDS) &&
        lastSenderMessageTime
      ) {
        // if (message.tid === 549) {
        //   console.log("___isMessageNotClient");
        //   console.log("lastSenderMessageTime: ", lastSenderMessageTime);
        // }
        // Calcular el tiempo de respuesta y añadirlo al array
        const responseTime = differenceInSeconds(
          new Date(message.mtimestamp * 1000),
          new Date(lastSenderMessageTime * 1000)
        );
        if (times.firstResponse === null) {
          times.firstResponse = secondsToDhms(responseTime);
          times.firstResponseMessage = message.mbody;
        }
        responseTimes.push(responseTime);
        lastSenderMessageTime = null; // Reset para el próximo par de mensajes
      }
    }

    if (lastSenderMessageTime) {
      times.waiting = differenceInSeconds(
        new Date(),
        new Date(lastSenderMessageTime * 1000)
      );
    }
    // Calcular el tiempo de respuesta promedio
    if (responseTimes.length > 0) {
      times.avgResponse =
        responseTimes.reduce((acc, time) => acc + time, 0) /
        responseTimes.length;
      times.avgResponse = secondsToDhms(times.avgResponse);
    }
  }
  return times;
};

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export const processTicketMessagesForReturnIATrainingData = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messageList: any[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  whatasappListIDS: any[]
) => {
  let messageListCopy = [...messageList];
  let trainingData = [];

  let messagesAreValidate = true;

  if (messageList.length === 1 && messageList[0].mid === null) {
    messagesAreValidate = false;
  }

  if (messagesAreValidate) {
    /**
     * Los mensajes llegan desornados
     */
    messageList.sort((a, b) => a.mtimestamp - b.mtimestamp);
    messageList = messageList.filter(m => {
      return (
        textoNoStardWithAutomatic(m.mbody) &&
        m.misPrivate !== 1 &&
        !m.mbody.includes("Gracias por tu comprensión") &&
        !m.mbody.includes("INCIDENCIA") &&
        !m.mbody.includes("Lun-Sab  8 a 1 pm / 3 a 6 pm") &&
        !m.mbody.includes("Mi nombre es Ariana Saldarriaga") &&
        !m.mbody.includes("BEGIN:VCARD") &&
        !/^[a-zA-Z0-9_-]+\.\w+$/.test(m.mbody) // avoid '1721314571690.pdf'
      );
    });

    const firstMessage = messageList[0];

    if (!firstMessage) {
      // console.log("------------ firstMessage IS NULL: ", messageListCopy);
    }

    if (firstMessage && isMessageClient(firstMessage, whatasappListIDS)) {
      // if (firstMessage.tid === 5571) {
      //   console.log("------------ first Message from 5571: ", firstMessage);
      // }

      trainingData.push(firstMessage);

      // eslint-disable-next-line no-restricted-syntax
      for (const message of messageList.slice(1)) {
        if (isMessageClient(message, whatasappListIDS)) {
          // if (firstMessage.tid === 5571) {
          //   console.log("------------ Message to push from 5571: ", message);
          // }
          trainingData.push(message);
        } else {
          // if (firstMessage.tid === 5571) {
          //   console.log("------------ message que rompió el 5571: ", message);
          // }
          break;
        }
      }

      // if (firstMessage.tid === 5571) {
      //   console.log("------------ trainingData de 5571: ", trainingData);
      // }
    }
  }

  // if (trainingData.find(m => m === null)) {
  //   console.log("------------ trainingData: ", trainingData);
  // }

  return trainingData.length > 0 ? trainingData : null;
};
