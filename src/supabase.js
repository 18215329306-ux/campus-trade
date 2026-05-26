import { createClient } from '@supabase/supabase-js'

// 把下面两行替换成你刚才在 Supabase → Settings → API 复制的值
const supabaseUrl = 'https://dgdoyadynfemnjurwvzx.supabase.co'
const supabaseKey = 'sb_publishable_Mayy1MGTu8cL0XPLwRr0zw_Fna4DuPp'

export const supabase = createClient(supabaseUrl, supabaseKey)
