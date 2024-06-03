# Ha DBStats

That's a small Node.JS and React app to check database usage.
You can install it as addon from [this repository](https://github.com/jehy/hass-addons).

## Local development
Install node version manager, install node 20, and run:
```shell
nvm use 20
cd backednd
npm ci
cd ../frontent
npm ci
cd ../shared
npm ci
cd../backend
DB_CONNECT_STRING=postgresql://LOGIN:PASSWORD@172.17.0.1:5432/DATABASE npm start
```
and in another console
```shell
cd frontent
npm start
```
## Running in docker container
You can use this addon standalone. To do it, just launch it with docker with the following compose file:

```yaml
version: '3.9'

services:  

  hass-dbstats:
    container_name: dbstats
    image: "ghcr.io/jehy/hass-dbstats:latest"
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - TZ=Europe/Moscow
      - DB_CONNECT_STRING=postgresql://LOGIN:PASSWORD@172.17.0.1:5432/DATABASE
    volumes:
      - hass_config:/homeassistant:ro
```


Please note that you should **either** pass **DB_CONNECT_STRING** or set volume `/homeassistant` to the location of where your config file resides.

### Optional env variables:
* `DB_QUERY_TIMEOUT` - max time for SQL queries to avoid hanging your database forever, defaults to 180 sec
* `MAX_ROWS_IN_CHART` - maximum rows in each chart, defaults to 30. Does not make things slower or faster, just set to suitable value for your database
