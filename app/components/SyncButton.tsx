'use client';
import { useState } from 'react';

export default function SyncButton() {
    const [loading, setLoading] = useState<boolean>(false);

    const handleSync = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/sync-elocal', { method: 'POST' });
            const data = await res.json();

            if (data.success) {
                alert('¡Sincronizado con Notion correctamente!');
            } else {
                alert('Hubo un error al sincronizar.');
            }
        } catch (error) {
            console.error(error);
            alert('Error de red al intentar sincronizar.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleSync}
            disabled={loading}
            style={{ padding: '10px 20px', backgroundColor: '#000', color: '#fff', borderRadius: '5px', cursor: 'pointer' }}
        >
            {loading ? 'Sincronizando con Notion...' : '🔄 Sincronizar eLocal a Notion'}
        </button>
    );
}