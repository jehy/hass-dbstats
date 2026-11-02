import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { json, urlencoded, static as serveStatic } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import configProvider from './config';
import { version } from '../package.json';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const basePath = (process.env.BASE_PATH ?? '')
    .split('/')
    .filter(Boolean)
    .join('/');
  const base = basePath ? `/${basePath}` : '';
  const staticRoot = process.env.STATIC_ROOT ?? '/var/www/html';
  app.setGlobalPrefix(`${base}/addon-api`);
  if (base) {
    // accept requests both with and without the base path (proxy may strip it)
    app.use((req: Request, _res: Response, next: NextFunction) => {
      if (
        req.url !== base &&
        !req.url.startsWith(`${base}/`) &&
        !req.url.startsWith(`${base}?`)
      ) {
        req.url = base + (req.url === '/' ? '/' : req.url);
      }
      next();
    });
  }
  // The frontend uses absolute asset URLs (the official add-on nginx rewrites
  // them); with a base path set they are prefixed here at serve time.
  const serveIndex = (_req: Request, res: Response) => {
    let html = readFileSync(join(staticRoot, 'index.html'), 'utf8');
    if (base) {
      html = html
        .replace(/(href|src)="\/(?!\/)/g, `$1="${base}/`)
        .replace('<head>', `<head><base href="${base}/" />`);
    }
    res.type('html').send(html);
  };
  const serveBundle = (req: Request, res: Response, next: NextFunction) => {
    if (!base || !/^\/static\/js\/[^/]+\.js$/.test(req.path)) {
      return next();
    }
    try {
      const js = readFileSync(join(staticRoot, req.path), 'utf8').replace(
        /\.p="\/"/,
        `.p="${base}/"`,
      );
      res.type('js').send(js);
    } catch {
      next();
    }
  };
  const staticHandler = serveStatic(staticRoot, { index: false });
  app.use(base || '/', (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return next();
    }
    if (req.path.startsWith('/addon-api') || req.path.startsWith('/api')) {
      return next();
    }
    if (req.path === '/' || req.path === '/index.html') {
      return serveIndex(req, res);
    }
    serveBundle(req, res, () =>
      staticHandler(req, res, (err?: unknown) =>
        err ? next(err) : serveIndex(req, res),
      ),
    );
  });
  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ extended: true, limit: '5mb' }));
  const config = new DocumentBuilder()
    .setTitle('dbstats API')
    .setDescription('dbstats API')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${base}/api`, app, document);

  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );
  await app.listen(configProvider().server.port);
  const logger = new Logger('bootstrap');
  logger.log(
    `DBStats version ${version} started on port ${
      configProvider().server.port
    }`,
  );
  if (process.env.SUPERVISOR_TOKEN) {
    logger.log(`Wow, we're running on supervisor!`);
  } else {
    logger.log(`Not running on supervisor, okay`);
  }
}
bootstrap();
