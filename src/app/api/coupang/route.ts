import { NextResponse } from 'next/server';
import crypto from 'crypto';

const ACCESS_KEY = (process.env.COUPANG_ACCESS_KEY || '').trim();
const SECRET_KEY = (process.env.COUPANG_SECRET_KEY || '').trim();

function makeAuthorization(method: string, path: string, query: string): { auth: string; datetime: string } {
  const now = new Date();
  const year = String(now.getUTCFullYear()).slice(2);
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  const hours = String(now.getUTCHours()).padStart(2, '0');
  const minutes = String(now.getUTCMinutes()).padStart(2, '0');
  const seconds = String(now.getUTCSeconds()).padStart(2, '0');
  
  const datetime = `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
  const message = datetime + method + path + (query ? `?${query}` : '');

  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(message)
    .digest('hex');

  const auth = `CEA algorithm=HmacSHA256, access-key=${ACCESS_KEY}, signed-date=${datetime}, signature=${signature}`;
  return { auth, datetime };
}

async function fetchGoldbox() {
  try {
    const apiPath = '/v2/providers/affiliate_open_api/apis/openapi/v1/products/goldbox';
    const query = 'limit=5';
    const { auth } = makeAuthorization('GET', apiPath, query);
    const url = `https://api-gateway.coupang.com${apiPath}?${query}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: { 
        'Authorization': auth,
        'Content-Type': 'application/json',
      },
    });

    if (res.ok) {
      const data = await res.json();
      const raw = data.data || [];
      const products = raw.slice(0, 5).map((p: any) => ({
        productId:    p.productId,
        productName:  p.productName,
        productPrice: p.productPrice,
        productImage: p.productImage,
        productUrl:   p.productUrl,
        isRocket:     p.isRocket,
      }));
      console.log('[Coupang] 골드박스');
      return NextResponse.json({ products });
    }
  } catch (e: any) {
    console.error('[Coupang] 골드박스 에러:', e.message);
  }
  return NextResponse.json({ products: [] });
}

export async function GET(req: Request) {
  if (!ACCESS_KEY || !SECRET_KEY) {
    console.error('[Coupang] 환경변수 누락');
    return NextResponse.json({ products: [] });
  }

  const { searchParams } = new URL(req.url);
  const keyword = searchParams.get('keyword') || '';
  const goldbox = searchParams.get('goldbox') === 'true';

  // 0. goldbox=true 요청 -> 골드박스
  if (goldbox) {
    return fetchGoldbox();
  }

  // 1. 키워드 검색
  if (keyword) {
    try {
      const apiPath = '/v2/providers/affiliate_open_api/apis/openapi/products/search';
      const query = `keyword=${encodeURIComponent(keyword)}&limit=5`;
      const method = 'GET';
      const { auth } = makeAuthorization(method, apiPath, query);
      const url = `https://api-gateway.coupang.com${apiPath}?${query}`;
      console.log(`[Coupang] 키워드 검색: ${keyword}`);

      const res = await fetch(url, {
        method,
        headers: { 
          'Authorization': auth,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        const data = await res.json();
        const raw = data.data || [];
        const products = (Array.isArray(raw) ? raw.slice(0, 5) : []).map((p: any) => ({
          productId:    p.productId,
          productName:  p.productName,
          productPrice: p.productPrice,
          productImage: p.productImage,
          productUrl:   p.productUrl,
          isRocket:     p.isRocket || false,
        }));
        if (products.length > 0) {
          console.log(`[Coupang] 검색 결과 ${products.length}개`);
          return NextResponse.json({ products });
        }
      } else {
        const errText = await res.text();
        console.warn(`[Coupang] 검색 실패 (${res.status}): ${errText.substring(0, 200)}`);
      }
    } catch (e: any) {
      console.error('[Coupang] 검색 중 에러:', e.message);
    }
  }

  // 2. 추천 상품(reco)
  try {
    const apiPath = '/v2/providers/affiliate_open_api/apis/openapi/v2/products/reco';
    const method = 'POST';
    const { auth } = makeAuthorization(method, apiPath, '');
    const url = `https://api-gateway.coupang.com${apiPath}`;

    const requestBody = {
      site: { id: '1', domain: 'blog.naver.com' },
      device: { id: '32chars_random_device_id_12345', lmt: 0 },
      imp: { imageSize: '300x300' },
      user: { puid: 'fonsinfo' },
    };

    console.log('[Coupang] 추천 상품 요청');

    const res = await fetch(url, {
      method,
      headers: { 
        'Authorization': auth,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = await res.json();
      let raw = data.data || [];
      if (!Array.isArray(raw)) {
        if (raw.productData && Array.isArray(raw.productData)) raw = raw.productData;
        else if (raw.products && Array.isArray(raw.products)) raw = raw.products;
        else raw = Object.values(raw).find((v) => Array.isArray(v)) || [];
      }
      const products = (Array.isArray(raw) ? raw.slice(0, 5) : []).map((p: any) => ({
        productId:    p.productId,
        productName:  p.productName,
        productPrice: p.productPrice,
        productImage: p.productImage,
        productUrl:   p.productUrl,
        isRocket:     p.isRocket || false,
      }));
      console.log(`[Coupang] 추천 ${products.length}개`);
      return NextResponse.json({ products });
    }
  } catch (e: any) {
    console.error('[Coupang] 추천 에러:', e.message);
  }

  // 3. 골드박스 fallback
  return fetchGoldbox();
}