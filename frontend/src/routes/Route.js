import React, { useContext } from "react";
import {
  matchPath,
  Redirect,
  Route as RouterRoute,
  useLocation,
} from "react-router-dom";

import BackdropLoading from "../components/BackdropLoading";
import { AuthContext } from "../context/Auth/AuthContext";

const Route = ({
  component: Component,
  isPrivate = false,
  myIsAdminOnly = false,
  isForAll = false,
  ...rest
}) => {
  const { isAuth, loading, user } = useContext(AuthContext);
  const location = useLocation();

  if (
    matchPath(location.pathname, {
      path: rest.path,
      exact: true,
    })
  ) {
    // Si no esta auth y la ruta es privada, redirige a login
    if (!isAuth && isPrivate) {
      return (
        <>
          {loading && <BackdropLoading />}
          <Redirect
            to={{ pathname: "/login", state: { from: rest.location } }}
          />
        </>
      );
    }

    // Si esta auth y la ruta no es privada, redirige al home
    if (isAuth && !isPrivate && !isForAll) {
      return (
        <>
          {loading && <BackdropLoading />}
          <Redirect to={{ pathname: "/", state: { from: rest.location } }} />;
        </>
      );
    }

    // Si esta auth, no es admin y la ruta es para admins, redirige a tickets
    if (isAuth && user?.profile !== "admin" && myIsAdminOnly) {
      return (
        <>
          {loading && <BackdropLoading />}
          <Redirect to={{ pathname: "/", state: { from: rest.location } }} />
        </>
      );
    }
  }

  return (
    <>
      {loading && <BackdropLoading />}
      <RouterRoute {...rest} component={Component} />
    </>
  );
};

export default Route;
