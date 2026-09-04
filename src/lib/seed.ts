import type { Student } from '@/types'

/** 班级原始名单（32 人） */
const RAW_NAMES: string[] = [
  '柏唐泽宇',
  '陈黎涛',
  '邓凯',
  '邓升旗',
  '邓思瑶',
  '邓育杰',
  '管彤',
  '胡文倩',
  '胡文强',
  '李鸿悦',
  '李嘉欣',
  '李军豪',
  '李文强',
  '彭海峰',
  '唐晨曦',
  '唐浩宇',
  '唐锦宜',
  '唐绮娴',
  '唐巧乐',
  '唐书颖',
  '唐雅琪',
  '唐语涵',
  '唐正豪',
  '王江涛',
  '王静涵',
  '王珞媛',
  '王希恩',
  '王馨怡',
  '吴霞',
  '杨晨曦',
  '于晨',
  '伍盈',
]

/** 生成初始学生列表（含稳定 id 与学号） */
export function createSeedStudents(): Student[] {
  return RAW_NAMES.map((name, index) => ({
    id: `s${String(index + 1).padStart(2, '0')}`,
    name,
    no: index + 1,
  }))
}

export { RAW_NAMES }
