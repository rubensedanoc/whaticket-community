import React, { createContext, useEffect, useState } from 'react';
import { toast } from "react-toastify";
import openSocket from "../services/socket-io";

// 1. Crear el Contexto
const ReloadDataBecauseSocketContext = createContext();

// 2. Crear un Provider del Contexto
const ReloadDataBecauseSocketContextProvider = ({ children }) => {
  const [_, setWasDisConnected] = useState('connecting');
  const [reconnect, setReconnect] = useState(0);

  useEffect(() => {
    const socket = openSocket();

    socket.on("connect", (data) => {
      // Las reconexiones de mantenimiento (limpieza de rooms) son invisibles
      // para el observador global: no recargan la bandeja ni muestran avisos.
      // Solo las reconexiones reales sincronizan la data.
      const isMaintenance = Boolean(data && data.__maintenance);
      if (isMaintenance) return;
      console.log("-------------------------connect-------------------------");

      setWasDisConnected((prevState) => {
        if (prevState === 'disconnected') {
          toast.success("Conexión al servidor restablecida");
          setReconnect((prevState) => prevState + 1);
        }
        return 'connected';
      });
    });

    socket.on("disconnect", (reason) => {
      const isMaintenance = Boolean(reason && reason.__maintenance);
      if (isMaintenance) return;
      console.log(
        ".........................disconnect........................."
      );
      setWasDisConnected((prevState) => {
        if (prevState === 'connected') {
          toast.error("Te desconectaste del servidor, dale F5");
          return 'disconnected'
        }
        return prevState;
      });
    });

    return () => {
      setWasDisConnected('connecting');
      socket.disconnect();
    };
  }, []);

  return (
    <ReloadDataBecauseSocketContext.Provider value={{reconnect}}>
      {children}
    </ReloadDataBecauseSocketContext.Provider>
  );
};

export { ReloadDataBecauseSocketContextProvider, ReloadDataBecauseSocketContext };