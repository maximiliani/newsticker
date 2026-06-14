import Link from "next/link";
import {Clock} from "@/components/Clock";
import {hasEnvVars} from "@/utils/supabase/check-env-vars";
import {EnvVarWarning} from "@/components/env-var-warning";
import HeaderAuth from "@/components/user/header-auth";

export function GlobalHeader() {
    return <header className="flex justify-between  w-full flex-col gap-2 items-center">
        <nav className="w-full flex justify-center border-b border-b-foreground/10">
            <div className="w-full flex justify-between items-center p-3 text-sm">
                <h1 className="font-bold text-4xl">
                    <Link href={"/"}>Newsticker</Link>
                </h1>
                <Clock/>
                <div className="flex items-center gap-4">
                    {!hasEnvVars ? <EnvVarWarning/> : <HeaderAuth/>}
                </div>
            </div>
        </nav>
    </header>;
}