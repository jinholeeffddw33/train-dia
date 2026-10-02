/** DB 한 줄 ↔ 화면 모양 — 서버 API 들이 함께 쓴다 */
import type { JidoRide } from './jidoTypes';

export interface RideRow {
  id: number;
  ride_date: string;
  driver_sabun: string;
  driver_name: string;
  guide_sabun: string | null;
  guide_name: string;
  train_no: string;
  formation: string;
  from_station: string;
  to_station: string;
  source: 'manual' | 'upload';
  created_by: string | null;
}

export const RIDE_SELECT =
  'id, ride_date, driver_sabun, driver_name, guide_sabun, guide_name, train_no, formation, from_station, to_station, source, created_by';

export function toRide(r: RideRow): JidoRide {
  return {
    id: r.id,
    date: r.ride_date.slice(0, 10),
    driverSabun: r.driver_sabun,
    driverName: r.driver_name,
    guideSabun: r.guide_sabun,
    guideName: r.guide_name,
    trainNo: r.train_no,
    formation: r.formation,
    fromStation: r.from_station,
    toStation: r.to_station,
    source: r.source,
    createdBy: r.created_by,
  };
}
