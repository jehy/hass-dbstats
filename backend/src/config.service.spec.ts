import { ConfigService } from './config.service';
import * as path from 'path';

describe('Config Service', () => {
  it('should find and parse simple connection string', () => {
    const res = new ConfigService(
      path.join(__dirname, 'testConfigs/postgres_simple'),
    );
    expect(res.data.typeOrmConfig).toEqual({
      type: 'postgres',
      url: 'postgresql://***@192.168.66.30:5432/homeass',
      extra: {
        query_timeout: 60_000,
        statement_timeout: 60_000, // one minute for a query to complete
      },
    });
  });
  it('should not die on non valid yaml', () => {
    const res = new ConfigService(
      path.join(__dirname, 'testConfigs/non_valid_yaml'),
    );
    expect(res.data.typeOrmConfig).toEqual({
      type: 'postgres',
      url: 'postgresql://***@192.168.66.30:5432/homeass',
      extra: {
        query_timeout: 60_000,
        statement_timeout: 60_000, // one minute for a query to complete
      },
    });
  });
  it('should find and parse connection string in secrets', () => {
    const res = new ConfigService(
      path.join(__dirname, 'testConfigs/postgres_with_secrets'),
    );
    expect(res.data.typeOrmConfig).toEqual({
      type: 'postgres',
      url: 'postgresql://***@192.168.66.30:5432/homeass',
      extra: {
        query_timeout: 60_000,
        statement_timeout: 60_000, // one minute for a query to complete
      },
    });
  });
  it('should handle multiple secrets', () => {
    const res = new ConfigService(
      path.join(__dirname, 'testConfigs/multiple_secrets'),
    );
    expect(res.data.typeOrmConfig).toEqual({
      type: 'postgres',
      url: 'postgresql://***@192.168.66.30:5432/homeass',
      extra: {
        query_timeout: 60_000,
        statement_timeout: 60_000, // one minute for a query to complete
      },
    });
  });
  it('should find and parse connection string in packages', () => {
    const res = new ConfigService(
      path.join(__dirname, 'testConfigs/postgres_with_packages'),
    );
    expect(res.data.typeOrmConfig).toEqual({
      type: 'postgres',
      url: 'postgresql://***@192.168.66.30:5432/homeass',
      extra: {
        query_timeout: 60_000,
        statement_timeout: 60_000, // one minute for a query to complete
      },
    });
  });
  it('should find sqlite file in config', () => {
    const res = new ConfigService(
      path.join(__dirname, 'testConfigs/sqlite_file_in_config'),
    );
    expect(res.data.typeOrmConfig).toEqual(
      expect.objectContaining({
        type: 'sqlite',
        flags: 1,
      }),
    );
    expect(res.data.typeOrmConfig.database).toContain('renamed.db');
  });
  it('should fall back to existing sqlite file', () => {
    const res = new ConfigService(
      path.join(__dirname, 'testConfigs/sqlite_file_exists'),
    );
    expect(res.data.typeOrmConfig).toEqual(
      expect.objectContaining({
        type: 'sqlite',
        flags: 1,
      }),
    );
    expect(res.data.typeOrmConfig.database).toContain('home-assistant_v2.db');
  });
  it('should throw when nothing found', () => {
    const throws = () =>
      new ConfigService(path.join(__dirname, 'testConfigs/nothing_found'));
    expect(throws).toThrow();
  });
  it('should find and parse include files', () => {
    const res = new ConfigService(
      path.join(__dirname, 'testConfigs/postgres_in_include'),
    );
    expect(res.data.typeOrmConfig).toEqual({
      type: 'postgres',
      url: 'postgresql://***@192.168.66.30:5432/homeass',
      extra: {
        query_timeout: 60_000,
        statement_timeout: 60_000, // one minute for a query to complete
      },
    });
  });
  it('should parse named include files with recorder', () => {
    const res = new ConfigService(
      path.join(__dirname, 'testConfigs/mysql_include'),
    );
    expect(res.data.typeOrmConfig).toEqual({
      type: 'mysql',
      url: 'mysql://root:***@192.168.66.30:5432/homeass?charset=utf8',
      extra: {
        options: '--max_execution_time=60000',
      },
    });
  });
  it('should not fail if some files dont exist in reality', () => {
    const res = new ConfigService(
      path.join(__dirname, 'testConfigs/files_dont_exist'),
    );
    expect(res.data.typeOrmConfig).toEqual({
      type: 'postgres',
      url: 'postgresql://***@192.168.66.30:5432/homeass',
      extra: {
        query_timeout: 60_000,
        statement_timeout: 60_000, // one minute for a query to complete
      },
    });
  });
});
