import * as YAML from 'js-yaml';
import * as fs from 'fs';
import * as path from 'path';
import type { DataSourceOptions } from 'typeorm';
import { Injectable, Logger } from '@nestjs/common';
import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import type { SqliteConnectionOptions } from 'typeorm/driver/sqlite/SqliteConnectionOptions';
import type { MysqlConnectionOptions } from 'typeorm/driver/mysql/MysqlConnectionOptions';

type DBType = DataSourceOptions['type'];

export type ConfigData = {
  typeOrmConfig: Partial<DataSourceOptions>;
  db: {
    logging: boolean;
  };
  server: {
    port: number;
  };
};

function findKey(object: Record<string, unknown>, key: string) {
  let value;
  Object.keys(object).some(function (k) {
    if (k === key) {
      value = object[k];
      return true;
    }
    if (object[k] && typeof object[k] === 'object') {
      value = findKey(object[k] as Record<string, unknown>, key);
      return value !== undefined;
    }
  });
  return value;
}

@Injectable()
export class ConfigService {
  public readonly data: ConfigData;
  private logger: Logger;
  private readonly secretCache = {} as Record<string, Record<string, string>>;
  constructor(haHomeDir?: string) {
    this.logger = new Logger(ConfigService.name);
    const { env } = process;
    const typeOrmConfig = this.extractRecorderConfig(
      haHomeDir || env.HOME_DIR || '/homeassistant',
      env.DB_CONNECT_STRING,
    );
    this.secretCache = {};
    this.data = {
      typeOrmConfig,
      db: {
        logging: env.DB_LOGGING === 'true',
      },
      server: {
        port: parseInt(env.SERVER_PORT, 10) || 3000,
      },
    };
    Object.freeze(this.data);
    const errorMessages = [];
    Object.entries(this.data).forEach(([sectionName, section]) => {
      Object.entries(section).forEach(([settingName, value]) => {
        if (value === undefined) {
          errorMessages.push(`${sectionName}.${settingName} not provided`);
        }
      });
    });
    if (errorMessages.length) {
      this.logger.log(errorMessages.join('\n'));
      process.exit(1);
    }
  }

  static getDbTypeFromConnectionString(dbConnectString: string): DBType {
    /*Examples from https://www.home-assistant.io/integrations/recorder/:

SQLite
sqlite:////PATH/TO/DB_NAME

MariaDB (omit pymysql)
mysql://user:password@SERVER_IP/DB_NAME?charset=utf8mb4

MariaDB (omit pymysql, using TLS encryption)
mysql://user:password@SERVER_IP/DB_NAME?charset=utf8mb4;ssl=true

MariaDB (omit pymysql, Socket)
mysql://user:password@SERVER_IP/DB_NAME?unix_socket=/var/run/mysqld/mysqld.sock&charset=utf8mb4

MySQL
mysql://user:password@SERVER_IP/DB_NAME?charset=utf8mb4

MySQL (using TLS encryption)
mysql://user:password@SERVER_IP/DB_NAME?charset=utf8mb4;ssl=true

MySQL (Socket)
mysql://user:password@localhost/DB_NAME?unix_socket=/var/run/mysqld/mysqld.sock&charset=utf8mb4

MariaDB
mysql+pymysql://user:password@SERVER_IP/DB_NAME?charset=utf8mb4

MariaDB (Socket)
mysql+pymysql://user:password@localhost/DB_NAME?unix_socket=/var/run/mysqld/mysqld.sock&charset=utf8mb4

PostgreSQL
postgresql://user:password@SERVER_IP/DB_NAME

PostgreSQL (Socket)
postgresql://@/DB_NAME

PostgreSQL (Custom socket dir)
postgresql://@/DB_NAME?host=/path/to/dir
*/
    if (dbConnectString.startsWith('postgres')) {
      return 'postgres';
    }
    if (dbConnectString.startsWith('mysql')) {
      return 'mysql';
    }
    if (dbConnectString.startsWith('sqlite')) {
      return 'sqlite';
    }
    throw new Error(`Unknown database type ${dbConnectString.split(':')[0]}`);
  }

  static connectionStringToDatabaseOptions(
    dbConnectString: string,
  ): Partial<DataSourceOptions> {
    const dbType = ConfigService.getDbTypeFromConnectionString(dbConnectString);
    if (dbType === 'sqlite') {
      // https://www.sqlite.org/c3ref/c_open_autoproxy.html
      // #define SQLITE_OPEN_READONLY         0x00000001  /* Ok for sqlite3_open_v2() */
      const database = dbConnectString.split('://')[1];
      //const tmpFileRecovered = '/tmp/copy.recovered.db';
      //childProcess.execSync(`sqlite3 ${database} ".clone ${tmpFileRecovered}"`);
      const options: SqliteConnectionOptions = {
        type: 'sqlite',
        database: database,
        flags: 0x00000001,
      };
      return options;
    }
    if (dbType === 'postgres') {
      const options: PostgresConnectionOptions = {
        type: 'postgres',
        url: `postgresql://${dbConnectString.split('://')[1]}`,
      };
      return options;
    }
    if (dbType === 'mysql') {
      const options: MysqlConnectionOptions = {
        type: 'mysql',
        url: `mysql://${dbConnectString.split('://')[1]}`,
      };
      return options;
    }
    throw new Error(`Unknown database type ${dbType}`);
  }

  replaceSecrets(data: string, secrets: Record<string, string>) {
    return Object.entries(secrets as Record<string, string>).reduce(
      (res, [secretName, secretValue]) => {
        return res.replace(`!secret ${secretName}`, secretValue);
      },
      data,
    );
  }

  fixYaml(
    data: string,
    secrets: Record<string, string>,
  ): { data: string; foundFilesOrDirs: Array<string> } {
    // UGLY workaround because those yaml tags are non-standard and otherwise parser throws on them :(

    //this.logger.log(`data`, data);
    const noComments = data
      .split('\n')
      .filter((el) => !el.trim().startsWith('#'))
      .join('\n');
    //this.logger.log(`noComments`, noComments);
    const ignoreTags = ['env_var', 'input'];
    const noUnknownTags = ignoreTags.reduce(
      (res, item) => res.split(`!${item}`).join(item),
      noComments,
    );
    //this.logger.log(`NoUnknownTags`, noUnknownTags);
    // https://github.com/home-assistant/core/blob/30710815f01fa1d184f1625c5a74f5e20e9f42a5/homeassistant/util/yaml/loader.py
    const includes = [
      'include_dir_merge_list',
      'include_dir_list',
      'include_dir_named',
      'include_dir_merge_named',
      'include',
    ];
    const foundFilesOrDirs = [];
    const noIncludes = noUnknownTags
      .split('\n')
      .map((str) => {
        return includes.reduce((res, item) => {
          if (!res) {
            return '';
          }
          const search = res.split(`!${item}`);
          if (search.length === 1) {
            return res;
          }
          foundFilesOrDirs.push(search[1].trim());
          return '';
        }, str);
      })
      .filter((el) => el)
      .join('\n');
    //this.logger.log(`noIncludes`, noIncludes);
    const noSecrets = this.replaceSecrets(noIncludes, secrets);
    //this.logger.log(`noSecrets`, noSecrets);
    const res = { data: noSecrets, foundFilesOrDirs };
    //this.logger.log(res);
    return res;
  }

  loadSecrets(dir: string, homeDir: string): Record<string, string> {
    if (this.secretCache[dir]) {
      return this.secretCache[dir];
    }
    const secretsFileName = path.join(dir, '/secrets.yaml');
    if (fs.existsSync(secretsFileName)) {
      this.logger.log(`found and parsed secrets file`);
      return YAML.load(fs.readFileSync(secretsFileName, 'utf-8'));
    }
    this.secretCache[dir] = {};
    let currentDir = dir;
    let secretsFound = false;
    while (currentDir.length > homeDir.length && !secretsFound) {
      currentDir = path.join(currentDir, '../');
      this.logger.log(`going up to ${currentDir}`);
      const upperDirSecrets = this.loadSecrets(currentDir, homeDir);
      if (Object.keys(upperDirSecrets).length !== 0) {
        secretsFound = true;
        this.secretCache[dir] = {
          ...this.secretCache[dir],
          ...upperDirSecrets,
        };
        return this.secretCache[dir];
      }
    }
    return {};
  }

  loadYaml(absPath: string, haHomeDir) {
    this.logger.log(`Input: abspath ${absPath} homeDir ${haHomeDir}`);
    if (fs.lstatSync(absPath).isDirectory()) {
      return fs
        .readdirSync(absPath, { recursive: true, encoding: 'utf-8' })
        .map((file) => path.join(absPath, file))
        .filter((file) => file.endsWith('.yaml'))
        .map((file) => this.loadYaml(file, haHomeDir));
    }
    const text = fs.readFileSync(absPath, 'utf-8');
    const secrets = this.loadSecrets(path.dirname(absPath), haHomeDir);
    this.logger.log(
      `${Object.keys(secrets).length} secrets found for file ${absPath}`,
    );
    const { data, foundFilesOrDirs } = this.fixYaml(text, secrets);
    //this.logger.log(`Found files:`, foundFilesOrDirs);
    const additional = foundFilesOrDirs.reduce((res, fileName) => {
      const newData = this.loadYaml(
        path.join(path.dirname(absPath), fileName),
        haHomeDir,
      );
      return { ...res, ...{ [fileName]: newData } };
    }, {});
    return { ...(data.trim() ? YAML.load(data) : {}), additional };
  }

  extractRecorderConfig(
    haHomeDir?: string,
    dbConnectString?: string,
  ): Partial<DataSourceOptions> {
    if (dbConnectString) {
      this.logger.log(`Using database options from env`);
      return ConfigService.connectionStringToDatabaseOptions(dbConnectString);
    }
    if (!haHomeDir) {
      throw new Error(
        `Neither home dir nor database connection string is provided!`,
      );
    }
    this.logger.log(`database options from env not found, checking config`);
    const configFileName = path.join(haHomeDir, '/configuration.yaml');
    if (!fs.existsSync(configFileName)) {
      throw new Error(`Config file not found in path ${haHomeDir}`);
    }
    this.logger.log(`config file found, parsing`);
    const data = this.loadYaml(configFileName, haHomeDir);
    this.logger.log(`parsed config file`);

    const recorder = findKey(data, 'recorder');
    if (recorder?.db_url) {
      this.logger.log(`found recorder config, gonna use it`);
      return ConfigService.connectionStringToDatabaseOptions(recorder.db_url);
    }
    this.logger.log(
      `recorder options not found, gonna try standard database path`,
    );
    const sqliteFileName = path.join(haHomeDir, '/home-assistant_v2.db');
    if (!fs.existsSync(sqliteFileName)) {
      throw new Error(`SQLite database file not found in ${sqliteFileName}`);
    }
    this.logger.log(
      `Found standard sqlite file, gonna use it: ${sqliteFileName}`,
    );
    return ConfigService.connectionStringToDatabaseOptions(
      `sqlite://${sqliteFileName}`,
    );
  }
}
