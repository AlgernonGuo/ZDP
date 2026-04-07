export interface Region {
  key: string
  label: string
  baseURL: string
}

export const REGIONS: Region[] = [
  { key: 'tj',  label: '天津', baseURL: 'http://qaweixin.flsoft.cc' },
  { key: 'sx',  label: '山西', baseURL: 'http://sxweixin.flsoft.cc' },
  { key: 'hd',  label: '邯郸', baseURL: 'http://zdweixin.flsoft.cc' },
]

export function getRegionByKey(key: string): Region | undefined {
  return REGIONS.find((r) => r.key === key)
}
