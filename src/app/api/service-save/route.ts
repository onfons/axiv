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

    if (action === 'delete_content') {
      const { id } = data;
      // CASCADE: content_places → content
      const { error: linkError } = await serviceClient
        .from('content_places')
        .delete()
        .eq('content_id', id);
      if (linkError) throw linkError;
      const { error: contentError } = await serviceClient
        .from('contents')
        .delete()
        .eq('id', id);
      if (contentError) throw contentError;
      return NextResponse.json({ success: true });
    }

    if (action === 'update_place_coords') {
      const { id, lat, lng } = data;
      const { data: result, error } = await serviceClient
        .from('places')
        .update({ lat, lng })
        .eq('id', id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === 'delete_place') {
      const { id } = data;
      // CASCADE: content_places → places
      const { error: linkError } = await serviceClient
        .from('content_places')
        .delete()
        .eq('place_id', id);
      if (linkError) throw linkError;
      const { error: placeError } = await serviceClient
        .from('places')
        .delete()
        .eq('id', id);
      if (placeError) throw placeError;
      // 관련 즐겨찾기도 삭제
      await serviceClient.from('favorites').delete().eq('place_id', id);
      return NextResponse.json({ success: true });
    }

    if (action === 'get_favorites_with_places') {
      const { userId } = data;
      const { data: favData, error } = await serviceClient
        .from('favorites')
        .select(`id, place:places (*)`)
        .eq('user_id', userId);
      if (error) throw error;
      return NextResponse.json({ data: favData });
    }

    if (action === 'check_favorite') {
      const { userId, placeId } = data as { userId: string; placeId: string };
      const { data: favData, error } = await serviceClient
        .from('favorites')
        .select('id')
        .match({ user_id: userId, place_id: placeId })
        .maybeSingle();
      if (error) throw error;
      return NextResponse.json({ isFavorite: !!favData, id: favData?.id });
    }

    if (action === 'toggle_favorite') {
      const d = data as { userId: string; placeId: string; isCurrentlyFavorite: boolean };
      if (d.isCurrentlyFavorite) {
        const { error } = await serviceClient
          .from('favorites')
          .delete()
          .match({ user_id: d.userId, place_id: d.placeId });
        if (error) throw error;
        return NextResponse.json({ isFavorite: false });
      } else {
        const { error } = await serviceClient
          .from('favorites')
          .insert({ user_id: d.userId, place_id: d.placeId });
        if (error) throw error;
        return NextResponse.json({ isFavorite: true });
      }
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('[Service API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}