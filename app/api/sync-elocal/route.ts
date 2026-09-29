import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

interface ELocalCall {
    call_id: string;
    call_date_time: string;
    caller_phone_number: string;
    caller_name?: string;
    call_duration_in_seconds?: number;
    cost?: number;
    category_name?: string;
    campaign_name?: string;
}

export async function POST() {
    try {
        console.log('🔄 Consultando la API de eLocal...');

        const apiKey = process.env.ELOCAL_API_KEY!;
        console.log(
            '🔑 Usando API Key:',
            apiKey ? 'Configurada (Primeros carácteres: ' + apiKey.substring(0, 4) + '...)' : 'NO CONFIGURADA'
        );

        // --- PASO DE DIAGNÓSTICO ---
        // Antes de pedir las llamadas, verificamos a qué cuenta pertenece esta API Key.
        // Esto nos dice si el 403 es porque la key es de una cuenta distinta
        // a la que es dueña de la campaña.
        console.log('🔍 Verificando cuenta asociada a la API Key...');
        const accountResponse = await fetch('https://apis.elocal.com/advertisers/v2/account', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        });

        const accountBody = await accountResponse.text();
        console.log(`📡 /account Status: ${accountResponse.status} ${accountResponse.statusText}`);
        console.log('🧾 Cuenta asociada a esta key:', accountBody);
        // ----------------------------

        const uuid = '588b72fb-6839-442c-aeae-91d8fdb09a93';

        const today = new Date();
        const pastDate = new Date();
        pastDate.setDate(today.getDate() - 30);

        const formatDate = (d: Date) => d.toISOString().split('T')[0];
        const startDateStr = formatDate(pastDate);
        const endDateStr = formatDate(today);

        const elocalUrl = `https://apis.elocal.com/advertisers/v2/campaign-results/${uuid}/calls.json?start_date=${startDateStr}&end_date=${endDateStr}`;

        console.log(`🌐 URL consultada: ${elocalUrl}`);

        // Header alineado con el ejemplo oficial de la documentación: solo Authorization: Bearer
        const elocalResponse = await fetch(elocalUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        });

        console.log(`📡 eLocal Response Status: ${elocalResponse.status} ${elocalResponse.statusText}`);

        if (!elocalResponse.ok) {
            const errorBody = await elocalResponse.text();
            console.error('❌ Cuerpo del error de eLocal:', errorBody);

            let parsedError: any = null;
            try {
                parsedError = JSON.parse(errorBody);
            } catch {
                // No era JSON
            }

            console.error('🧾 Detalle del error (parseado si era JSON):', parsedError ?? errorBody);

            throw new Error(
                `Error al obtener datos de eLocal: ${elocalResponse.status} - ${
                    parsedError ? JSON.stringify(parsedError) : errorBody
                }`
            );
        }

        const data = await elocalResponse.json();
        const elocalCalls: ELocalCall[] = data.calls || [];
        console.log(`✅ Llamadas obtenidas de eLocal: ${elocalCalls.length}`);

        // Lógica de sincronización con Notion
        const notionPages: any[] = [];
        let cursor: string | undefined = undefined;

        do {
            const response: any = await (notion.databases as any).query({
                database_id: process.env.NOTION_DATABASE_ID!,
                start_cursor: cursor,
                page_size: 100,
            });

            notionPages.push(...response.results);
            cursor = response.has_more && response.next_cursor ? response.next_cursor : undefined;
        } while (cursor);

        const notionMap = new Map<string, string>();
        for (const page of notionPages) {
            const props = (page as any).properties;
            const phoneProp = props['Teléfono']?.phone_number || props['Teléfono']?.rich_text?.[0]?.plain_text;

            if (phoneProp) {
                notionMap.set(phoneProp, page.id);
            }
        }

        for (const call of elocalCalls) {
            const phone = call.caller_phone_number;
            if (!phone) continue;

            const existingPageId = notionMap.get(phone);

            const properties: any = {
                'Nombre': {
                    title: [{ text: { content: call.caller_name || 'Sin Nombre' } }],
                },
                'Teléfono': { phone_number: phone },
                'Categoría': { select: call.category_name ? { name: call.category_name } : null },
                'Servicio': { select: call.campaign_name ? { name: call.campaign_name } : null },
            };

            if (existingPageId) {
                await notion.pages.update({
                    page_id: existingPageId,
                    properties: properties,
                });
            } else {
                await notion.pages.create({
                    parent: { database_id: process.env.NOTION_DATABASE_ID! },
                    properties: properties,
                });
            }
        }

        console.log('🎉 ¡Sincronización masiva completada con éxito!');
        return NextResponse.json({ success: true, message: '¡Sincronización masiva completada con éxito!' });
    } catch (error: any) {
        console.error('💥 Error crítico en la sincronización:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}