import {Suspense} from "react";
import ArticleManager from "@/features/articles/components/article-manager";

export default async function ManageArticles() {
    return (
        <>
            {/* Article manager with suspense boundary for streaming */}
            <div className="mt-6">
                <Suspense fallback={<div className="text-center py-8">Loading articles...</div>}>
                    <ArticleManager/>
                </Suspense>
            </div>
        </>
    );
}