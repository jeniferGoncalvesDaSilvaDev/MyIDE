import { Router, type IRouter } from "express";
import healthRouter from "./health";
import aiRouter from "./ai/index";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/ai", aiRouter);

export default router;
