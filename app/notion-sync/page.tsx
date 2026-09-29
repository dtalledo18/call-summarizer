import SyncButton from "@/app/components/SyncButton";

export default function NotionSyncPage() {
    return (
        <div className="max-w-xl mx-auto mt-16 p-8 bg-white shadow-md rounded-xl border border-gray-100 text-center">
            <h1 className="text-2xl font-bold mb-2">Sincronización con Notion</h1>
            <p className="text-gray-600 mb-6">
                Haz clic en el botón para sincronizar de manera masiva todos los registros de eLocal directamente hacia tu base de datos de Notion.
            </p>
            <SyncButton />
        </div>
    );
}