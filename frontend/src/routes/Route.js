import React, { useContext } from "react";
import { Redirect, Route as RouterRoute } from "react-router-dom";

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

  if (!isAuth && isPrivate) {
    return (
      <>
        {loading && <BackdropLoading />}
        <Redirect to={{ pathname: "/login", state: { from: rest.location } }} />
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

  return (
    <>
      {loading && <BackdropLoading />}
      <RouterRoute {...rest} component={Component} />
    </>
  );
};

export default Route;
