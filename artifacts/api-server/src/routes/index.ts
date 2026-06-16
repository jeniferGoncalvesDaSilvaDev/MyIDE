import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai/index";
import runRouter from "./run";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/ai", aiRouter);
router.use("/run", runRouter);

export default router;
