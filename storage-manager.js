// ============================================
// STORAGE MANAGER - Gestion centralisée des documents
// ============================================

const StorageManager = {
    /**
     * Upload un document dans le storage Supabase
     * @param {string} entityType - 'vehicles', 'drivers', ou 'tachographs'
     * @param {string} entityId - ID de l'entité
     * @param {File} file - Fichier à uploader
     * @param {Object} metadata - Métadonnées additionnelles (nom, date expiration, etc.)
     */
    async uploadDocument(entityType, entityId, file, metadata = {}) {
        try {
            const user = App.user;
            if (!user?.companyId) throw new Error('User not authenticated');

            // Générer le chemin du fichier
            const timestamp = Date.now();
            const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
            const fileName = `${timestamp}_${sanitizedFileName}`;
            const filePath = `${user.companyId}/${entityType}/${entityId}/${fileName}`;

            console.log('Uploading to:', filePath);

            // Upload le fichier
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('documents')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (uploadError) throw uploadError;

            // Créer une URL signée valide 1 an
            const { data: urlData, error: urlError } = await supabase.storage
                .from('documents')
                .createSignedUrl(filePath, 31536000); // 1 an

            if (urlError) throw urlError;

            return {
                path: filePath,
                url: urlData.signedUrl,
                name: metadata.name || file.name,
                expiryDate: metadata.expiryDate || null,
                uploadedAt: new Date().toISOString(),
                fileName: file.name,
                fileSize: file.size,
                mimeType: file.type
            };
        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    },

    /**
     * Supprimer un document du storage
     * @param {string} filePath - Chemin complet du fichier
     */
    async deleteDocument(filePath) {
        try {
            const { error } = await supabase.storage
                .from('documents')
                .remove([filePath]);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Delete error:', error);
            throw error;
        }
    },

    /**
     * Récupérer tous les documents de l'utilisateur courant
     */
    async getUserDocuments() {
        try {
            const user = App.user;
            if (!user?.email) throw new Error('User not authenticated');

            const { data, error } = await supabase
                .rpc('get_user_documents', { user_email: user.email });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Get documents error:', error);
            throw error;
        }
    },

    /**
     * Rechercher des documents
     * @param {string} searchTerm - Terme de recherche
     */
    async searchDocuments(searchTerm) {
        try {
            const user = App.user;
            if (!user?.companyId) throw new Error('User not authenticated');

            const { data, error } = await supabase
                .rpc('search_documents', {
                    search_term: searchTerm,
                    user_company_id: user.companyId
                });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Search error:', error);
            throw error;
        }
    },

    /**
     * Obtenir les statistiques de stockage
     */
    async getStorageStats() {
        try {
            const user = App.user;
            if (!user?.companyId) throw new Error('User not authenticated');

            const { data, error } = await supabase
                .rpc('get_storage_stats', { user_company_id: user.companyId });

            if (error) throw error;
            return data?.[0] || {
                total_files: 0,
                total_size: 0,
                total_size_mb: 0,
                vehicle_files: 0,
                driver_files: 0,
                tacho_files: 0
            };
        } catch (error) {
            console.error('Stats error:', error);
            throw error;
        }
    },

    /**
     * Télécharger un document
     * @param {string} filePath - Chemin du fichier
     */
    async downloadDocument(filePath) {
        try {
            const { data, error } = await supabase.storage
                .from('documents')
                .download(filePath);

            if (error) throw error;

            // Créer un lien de téléchargement
            const url = URL.createObjectURL(data);
            const a = document.createElement('a');
            a.href = url;
            a.download = filePath.split('/').pop();
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            return true;
        } catch (error) {
            console.error('Download error:', error);
            throw error;
        }
    },

    /**
     * Obtenir une URL signée pour un fichier
     * @param {string} filePath - Chemin du fichier
     * @param {number} expiresIn - Durée de validité en secondes (défaut: 1 heure)
     */
    async getSignedUrl(filePath, expiresIn = 3600) {
        try {
            const { data, error } = await supabase.storage
                .from('documents')
                .createSignedUrl(filePath, expiresIn);

            if (error) throw error;
            return data.signedUrl;
        } catch (error) {
            console.error('Signed URL error:', error);
            throw error;
        }
    },

    /**
     * Lister tous les fichiers d'une entité
     * @param {string} entityType - Type d'entité
     * @param {string} entityId - ID de l'entité
     */
    async listEntityFiles(entityType, entityId) {
        try {
            const user = App.user;
            if (!user?.companyId) throw new Error('User not authenticated');

            const prefix = `${user.companyId}/${entityType}/${entityId}/`;

            const { data, error } = await supabase.storage
                .from('documents')
                .list(prefix);

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('List files error:', error);
            throw error;
        }
    },

    /**
     * Formater la taille d'un fichier
     * @param {number} bytes - Taille en bytes
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
};

// Rendre disponible globalement
window.StorageManager = StorageManager;
