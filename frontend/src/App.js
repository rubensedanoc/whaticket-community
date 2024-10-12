import React, { useEffect, useState } from "react";
import "react-toastify/dist/ReactToastify.css";
import Routes from "./routes";

import { ptBR } from "@material-ui/core/locale";
import { createTheme, ThemeProvider } from "@material-ui/core/styles";
import "./styles.css";

const App = () => {
  const [locale, setLocale] = useState();

  const theme = createTheme(
    {
      scrollbarStyles: {
        "&::-webkit-scrollbar": {
          width: "6px",
          height: "8px",
        },
        "&::-webkit-scrollbar-thumb": {
          boxShadow: "inset 0 0 6px rgba(0, 0, 0, 0.3)",
          backgroundColor: "#e8e8e8",
          // borderRadius: "8px",
        },
      },
      palette: {
        primary: { main: "#2576d2" },
      },
    },
    locale
  );

  theme.typography.body2 = {
    fontSize: "0.8rem",
  };

  useEffect(() => {
    const i18nlocale = localStorage.getItem("i18nextLng");
    const browserLocale =
      i18nlocale.substring(0, 2) + i18nlocale.substring(3, 5);

    if (browserLocale === "ptBR") {
      setLocale(ptBR);
    }
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <Routes />
    </ThemeProvider>
  );
};

export default App;
