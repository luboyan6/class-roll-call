import type { ClassRoom, Student } from '@/types'

/** 2501 班原始名单（32 人） */
const RAW_2501: string[] = [
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

/** 2503 班原始名单（36 人） */
const RAW_2503: string[] = [
  '张茜',
  '唐琪萌',
  '李俊杰',
  '邓诗雨',
  '肖欣琴',
  '陆琦',
  '雷汉卿',
  '彭仁帅',
  '谭沛晨',
  '王宜豪',
  '唐明勋',
  '唐鑫',
  '唐嘉泽',
  '王艺桦',
  '邓晨睿',
  '于嘉辉',
  '唐峻熙',
  '唐紫晴',
  '成俊杰',
  '吴宇翔',
  '唐武',
  '唐炜晨',
  '任军杰',
  '方文龙',
  '唐程理',
  '袁金哲',
  '唐雪锋',
  '邓芳婷',
  '唐熙雯',
  '李嘉佑',
  '王恺',
  '李亚碟',
  '刘明慧',
  '王倩',
  '李梦璐',
  '李永嘉',
]

/**
 * 生成班级对象。
 * id 固定成 class-2501 这种形式：老用户的记录里存的是旧学生 id，
 * 班级 id 稳定才能保证迁移后历史记录还能对上号。
 */
function makeClass(name: string, raw: string[]): ClassRoom {
  const id = `class-${name}`
  const students: Student[] = raw.map((n, i) => ({
    id: `${id}-s${String(i + 1).padStart(2, '0')}`,
    name: n,
    no: i + 1,
  }))
  return { id, name, students, cursor: 0 }
}

/** 初始班级列表：2501 与 2503 */
export function createSeedClasses(): ClassRoom[] {
  return [makeClass('2501', RAW_2501), makeClass('2503', RAW_2503)]
}

export { RAW_2501, RAW_2503 }
