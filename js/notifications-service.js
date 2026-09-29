/* Notification-only bridge for standalone pages; preserves all existing CRUD helpers. */
(function(){'use strict';const DbService=window.DbService;Object.assign(DbService,{
    addNotification: async function (userId, notification) {
        await fbDb.collection(COLLECTIONS.NOTIFICATIONS).add({
            userId:    userId,
            read:      false,
            createdAt: FieldValue.serverTimestamp(),
            ...notification           // { title, body, type?, link? }
        });
    },

    /** Mark a single notification read. */
    markNotificationRead: async function (notifId) {
        await fbDb.collection(COLLECTIONS.NOTIFICATIONS).doc(notifId)
            .update({ read: true, readAt: FieldValue.serverTimestamp() });
    },

    /** Mark ALL of the current user's notifications read. */
    markAllNotificationsRead: async function () {
        const uid = AuthService.getUid();
        if (!uid) return;
        const snap = await fbDb.collection(COLLECTIONS.NOTIFICATIONS)
            .where('userId', '==', uid).where('read', '==', false).get();
        for(let i=0;i<snap.docs.length;i+=400){const batch=fbDb.batch();snap.docs.slice(i,i+400).forEach(d=>batch.update(d.ref,{read:true,readAt:FieldValue.serverTimestamp()}));await batch.commit();}
    },

    listenNotifications: function (userId, callback, onError) {
        return fbDb.collection(COLLECTIONS.NOTIFICATIONS)
            .where('userId', '==', userId)
            .onSnapshot(function (snap) {
                callback(snap.docs.map(function (d) { return { id: d.id, ...d.data() }; }).sort(function(a,b){const ms=x=>x&&x.toMillis?x.toMillis():x&&x.seconds?x.seconds*1000:0;return ms(b.createdAt)-ms(a.createdAt);}));
            }, onError || function (err) { console.error("[AssureX] Notification listener:", err); });
    },

});
DbService.notifyAction = function(action,details){
 const uid=AuthService.getUid();if(!uid)return Promise.resolve();
 action=({CREATE_PRODUCT:'product_created',UPDATE_PRODUCT:'product_updated',DELETE_PRODUCT:'product_deleted'})[action]||action;
 // Personal inbox is reserved for product-linked claim events. Other activity remains in the admin audit stream.
 if (!['claim_submission','claim_review','status_change','missing_documents'].includes(action)) return Promise.resolve();
 const titles={product_created:'Product registered',product_updated:'Product updated',product_deleted:'Product deleted',document_added:'Document uploaded',document_uploaded:'Document uploaded',document_updated:'Document updated',document_deleted:'Document deleted',claim_updated:'Claim updated',claim_deleted:'Claim deleted',repair_record_created:'Repair record saved',repair_record_updated:'Repair record updated',repair_record_deleted:'Repair record deleted',profile_updated:'Profile updated',system_setting_updated:'Settings updated',user_created:'User account created'};
 if(!titles[action])return Promise.resolve();
 const link=action.startsWith('product')?'products.html':action.startsWith('document')?'documents.html':action.startsWith('repair')?'repair-history.html':action.startsWith('profile')?'profile.html':action.startsWith('claim')?'claims.html':'admin.html';
 return DbService.addNotification(uid,{title:titles[action],body:'Your change was saved successfully.',type:action,link,details:details||{}}).catch(e=>console.warn('[Notification] Could not save activity notification:',e));
};
window.DbService.notifyAction=DbService.notifyAction;

})();
