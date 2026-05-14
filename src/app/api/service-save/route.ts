import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const serviceClient = createClient(supabaseUrl, serviceRoleKey);

export async function POST(req: Request) {
  if (!serviceRoleKey) {
    return NextResponse.json({ error: 'Service role not configured' }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { action, data } = body;

    if (action === 'upsert_content') {
      const { data: result, error } = await serviceClient
        .from('contents')
        .upsert(data, { onConflict: 'video_id' })
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ data: result });
    }

    if (action === 'upsert_place') {
      const { data: result, error } = await serviceClient
        .from('places')
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json({ data: result });
    }

    if (action === 'upsert_content_place') {
      const { data: result, error } = await serviceClient
        .from('content_places')
        .upsert(data, { onConflict: 'content_id,place_id' })
        .select();
      if (error) throw error;
      return NextResponse.json({ data: result });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('[Service API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}