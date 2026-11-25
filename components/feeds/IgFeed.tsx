import { IgFeedClient } from "./IgFeedClient";
import { loadInstagramAccounts, loadInstagramPage } from "@/features/instagram/services/feed-actions";

export default async function IgFeed() {
    const [page, availableUsers] = await Promise.all([
        loadInstagramPage(),
        loadInstagramAccounts(),
    ]);

    return <IgFeedClient initialPage={page} availableUsers={availableUsers} />;
}
