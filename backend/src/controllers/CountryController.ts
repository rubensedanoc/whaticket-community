import { Request, Response } from "express";

import Country from "../models/Country";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const allCountries = await Country.findAll();

  return res.json({ countries: allCountries });
};
