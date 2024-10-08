import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { ICountStats, IShowAlerts } from '@dbstats/shared/src/stats';
import { Statistics } from '../entities/homeass/2024.1.5/Statistics';
import configProvider from '../config';
import { version } from '../../package.json';

@Injectable()
export class SystemService {
  private logger: Logger;
  constructor(
    @InjectRepository(Statistics, 'homeass')
    private repoLong: Repository<Statistics>,
  ) {
    this.logger = new Logger(SystemService.name);
  }

  private async getSqliteTables() {
    return (await this.repoLong.manager.query(
      `SELECT name FROM sqlite_master WHERE type='table'`,
    )) as Array<{ name: string }>;
  }

  async getTableRows(): Promise<Array<ICountStats>> {
    //select m.entity_id, count(1) from states s, states_meta m where s.metadata_id=m.metadata_id group by m.entity_id
    const dbType = configProvider().typeOrmConfig.type;
    if (dbType === 'sqlite') {
      const tables = await this.getSqliteTables();
      const res = [];
      for (let i = 0; i < tables.length; i++) {
        const rows = (await this.repoLong.manager.query(
          `SELECT count (*) cnt from ${tables[i].name}`,
        )) as Array<{ cnt: number }>;
        res.push({ type: tables[i].name, cnt: rows[0].cnt });
      }
      return res.sort((a, b) => b.cnt - a.cnt);
    }
    if (dbType === 'postgres') {
      const data = await this.repoLong.manager
        .query(`SELECT relname type,n_live_tup cnt
              FROM pg_stat_user_tables
            ORDER BY n_live_tup DESC`);
      return data;
    }
    if (dbType === 'mysql') {
      const data = await this.repoLong.manager.query(
        `SELECT table_name type, TABLE_ROWS cnt FROM INFORMATION_SCHEMA.TABLES WHERE table_schema = DATABASE() order by TABLE_ROWS DESC`,
      );
      return data;
    }
    throw new BadRequestException(
      `Database type ${dbType} not supported yet for this chart`,
    );
  }

  async getTableSize(): Promise<Array<ICountStats>> {
    //select m.entity_id, count(1) from states s, states_meta m where s.metadata_id=m.metadata_id group by m.entity_id
    const dbType = configProvider().typeOrmConfig.type;
    if (dbType === 'sqlite') {
      const tables = await this.getSqliteTables();
      const res = [];
      for (let i = 0; i < tables.length; i++) {
        const rows = (await this.repoLong.manager.query(
          `SELECT SUM("pgsize")/1024/1024 cnt FROM "dbstat" WHERE name='${tables[i].name}';`,
        )) as Array<{ cnt: number }>;
        res.push({ type: tables[i].name, cnt: rows[0].cnt });
      }
      return res.sort((a, b) => b.cnt - a.cnt);
    }
    if (dbType === 'postgres') {
      const data = await this.repoLong.manager.query(`select
        table_name type,
            pg_total_relation_size(quote_ident(table_name))/1024/1024 cnt
        from information_schema.tables
        where table_schema = 'public'
        order by pg_total_relation_size(quote_ident(table_name)) desc;`);
      return data;
    }
    if (dbType === 'mysql') {
      const data = await this.repoLong.manager.query(`SELECT 
     table_schema as \`Database\`, 
     table_name type, 
     round(((data_length + index_length) / 1024 / 1024), 2) cnt 
FROM information_schema.TABLES  WHERE table_schema = DATABASE()
ORDER BY (data_length + index_length) DESC;`);
      return data;
    }
    throw new BadRequestException(
      `Database type ${dbType} not supported yet for this chart`,
    );
  }

  async getVersion(): Promise<string> {
    const dbType = configProvider().typeOrmConfig.type;
    if (dbType === 'sqlite') {
      const data = (await this.repoLong.manager.query(
        `SELECT sqlite_version() as version`,
      )) as Array<{ version: string }>;
      return data[0].version;
    }
    if (dbType === 'postgres') {
      const data = (await this.repoLong.manager.query(
        `SELECT VERSION() as version;`,
      )) as Array<{ version: string }>;
      return data[0].version;
    }
    if (dbType === 'mysql') {
      const data = (await this.repoLong.manager.query(
        `SELECT VERSION() as version`,
      )) as Array<{ version: string }>;
      return data[0].version;
    }
    throw new BadRequestException(
      `Database type ${dbType} not supported yet for this chart`,
    );
  }

  async getDbAlerts(): Promise<Array<IShowAlerts>> {
    const alerts: Array<IShowAlerts> = [];
    const dbType = configProvider().typeOrmConfig.type;
    let dbVersion = 'unknown';
    try {
      dbVersion = await this.getVersion();
      if (dbVersion.length > 42) {
        dbVersion = dbVersion.substring(0, 42).trim() + '...';
      }
    } catch (err) {
      this.logger.warn(`Failed to get database version: ${err.message}`);
    }
    alerts.push({
      type: 'info',
      text: `Running with dbstats core version ${version} on database type ${dbType} version ${dbVersion}`,
    });
    return alerts;
  }
}
