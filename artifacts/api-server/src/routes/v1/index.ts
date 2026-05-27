import { Router, type IRouter } from "express";
import metaRouter from "./meta.js";
import addressesRouter from "./addresses.js";
import coverageRouter from "./coverage.js";

const router: IRouter = Router();

router.use("/v1", metaRouter);
router.use("/v1/addresses", addressesRouter);
router.use("/v1/coverage", coverageRouter);

export default router;
