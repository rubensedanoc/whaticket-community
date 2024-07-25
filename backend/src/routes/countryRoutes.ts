import express from "express";
import isAuth from "../middleware/isAuth";

import * as CountryController from "../controllers/CountryController";

const contryRoutes = express.Router();

contryRoutes.get("/countries", isAuth, CountryController.index);

export default contryRoutes;
