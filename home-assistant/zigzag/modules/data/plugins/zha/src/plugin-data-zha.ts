import {
  PluginDataBase,
  PluginConfigData,
  ZHADevice,
  ZHA_UNKNOWN,
  Zag,
  Zig,
} from "@samantha-uk/zigzag-data";
import { Connection } from "home-assistant-js-websocket";

interface PluginConfigDataZHA extends PluginConfigData {
  connection: Connection;
}

const ZHA_DEVICES_REQUEST = `zha/devices`;

// Datasource used to read zigs & zags from from a system with zha/zha-map.
export class DataPlugin extends PluginDataBase {
  public readonly fqpi = `${this.id}-zha`;

  public readonly config: PluginConfigDataZHA;

  constructor(config: PluginConfigDataZHA) {
    super();
    this.config = config;
  }

  // Fetch the device data using web sockets
  public async fetchData(): Promise<{ zigs: Zig[]; zags: Zag[] }> {
    const _zigs: Zig[] = [];
    const _zags: Zag[] = [];
    try {
      const zhaDevices = await this.config.connection.sendMessagePromise<
        ZHADevice[]
      >({
        type: ZHA_DEVICES_REQUEST,
      });

      DataPlugin._mapDevices(zhaDevices, _zigs, _zags);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.log(`Zigzag - DataSourceZHA -> fetchData failed:`, error);
    }
    return { zigs: _zigs, zags: _zags };
  }

  private static _fixupDevices(zigs: Zig[], zags: Zag[]) {
    zags.forEach((zag: Zag) => {
      // Check to ensure the neighbor Zig exists
      const _zigToFind = zigs.find((zig: Zig) => zig.ieee === zag.ieee);
      // Absence means the neighbor scan reports a device that ZHA does not know about.
      // We will create a dummy Zig to reflect this.
      if (!_zigToFind) {
        zigs.push(({
          ieee: zag.ieee,
          name: ZHA_UNKNOWN,
          device_type: zag.device_type,
          nwk: 0,
          lqi: zag.lqi,
          rssi: 0,
          last_seen: ZHA_UNKNOWN,
          manufacturer: ZHA_UNKNOWN,
          model: ZHA_UNKNOWN,
          quirk_applied: ZHA_UNKNOWN,
          quirk_class: ZHA_UNKNOWN,
          manufacturer_code: ZHA_UNKNOWN,
          device_reg_id: ZHA_UNKNOWN,
          power_source: ZHA_UNKNOWN,
          available: true,
        } as unknown) as Zig);
      }
    });
  }

  // Map the data into the zig objects.
  private static _mapDevices(
    zhaDevices: ZHADevice[],
    zigs: Zig[],
    zags: Zag[]
  ): void {
    zigs.length = 0;
    for (const device of zhaDevices) {
      zigs.push(({ ...device } as unknown) as Zig);

      // Map the device neighbor structure into Zags.
      this._mapZags(device, zags);
    }

    // Ensure consistency between zigs & zags
    DataPlugin._fixupDevices(zigs, zags);
  }

  private static _mapZags(device: ZHADevice, zags: Zag[]): void {
    for (const neighbor of device.neighbors) {
      zags.push(({ from: device.ieee, ...neighbor } as unknown) as Zag);
    }
  }
}
