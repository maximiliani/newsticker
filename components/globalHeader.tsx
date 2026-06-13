import Link from "next/link";
import {Clock} from "@/components/Clock";
import {hasEnvVars} from "@/utils/supabase/check-env-vars";
import {EnvVarWarning} from "@/components/env-var-warning";
import HeaderAuth from "@/components/user/header-auth";

export function GlobalHeader() {
    return <header className="flex justify-between flex-1 w-full flex flex-col gap-2 items-cente">
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
            <div className="w-full flex justify-between items-center p-3 text-sm">
                <div className="flex items-center gap-8">
                    <h1 className="font-bold text-4xl">
                        <Link href={"/"}>Newsticker</Link>
                    </h1>
                    <div className="hidden md:flex items-center gap-4">
                    </div>
                </div>
                <Clock/>
                <div className="flex items-center gap-4">
                    {!hasEnvVars ? <EnvVarWarning/> : <HeaderAuth/>}
                </div>
            </div>
        </nav>
    </header>;
}