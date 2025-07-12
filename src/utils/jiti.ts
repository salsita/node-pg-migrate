import { type JitiOptions, createJiti } from 'jiti';

const options: JitiOptions = {};

const createLoader = (options: JitiOptions) =>
  createJiti(process.cwd(), options);

export const jiti = createLoader(options);
