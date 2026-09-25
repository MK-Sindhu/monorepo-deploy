import {db} from "db";

export const dynamic = "force-dynamic";

export default async function Home() {
  const users = await db.orm.public.User.all();
  return (
    <div>
      {JSON.stringify(users)}
    </div>
  )
}
