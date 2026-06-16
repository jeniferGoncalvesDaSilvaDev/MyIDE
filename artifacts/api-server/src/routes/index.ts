import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai/index";
import runRouter from "./run";
import terminalRouter from "./terminal";
import lintRouter from "./lint";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/ai", aiRouter);
router.use("/run", runRouter);
router.use("/terminal", terminalRouter);
router.use("/lint", lintRouter);

export default router;
