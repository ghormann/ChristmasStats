CREATE DATABASE IF NOT EXISTS mqtt;
USE mqtt;
CREATE TABLE IF NOT EXISTS mqtt.name (name VARCHAR(255), name_type varchar(255), source varchar(255), ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP, index name_ts_idx(ts));
CREATE TABLE IF NOT EXISTS mqtt.event (name VARCHAR(255), argument varchar(255), ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP, index event_ts_idx(ts));
CREATE TABLE IF NOT EXISTS mqtt.song (songid SMALLINT, source varchar(255), ts TIMESTAMP DEFAULT CURRENT_TIMESTAMP, index song_ts_idx(ts));
