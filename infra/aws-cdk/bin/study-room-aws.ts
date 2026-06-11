#!/usr/bin/env node
import path from "node:path";

import { App } from "aws-cdk-lib";

import { StudyRoomAwsStack } from "../src/study-room-aws-stack.js";

const app = new App();
const projectRoot = path.resolve(process.cwd(), "..", "..");
const webDistPathContext = app.node.tryGetContext("webDistPath");
const scheduleMinutesContext = app.node.tryGetContext("scheduleMinutes");

new StudyRoomAwsStack(app, "StudyRoomAwsStack", {
  webDistPath: webDistPathContext
    ? path.resolve(String(webDistPathContext))
    : path.join(projectRoot, "apps", "web", "dist"),
  scheduleMinutes: scheduleMinutesContext ? Number(scheduleMinutesContext) : undefined,
});
