import { getUCLTableAction, getUclScorersAction, getUclAssistsAction } from "@/lib/table/actions";
import { UCLTableView } from "@/components/table/ucl-table-view";

export const dynamic = "force-dynamic";

export default async function TablePage() {
  const [{ table, completeness, mode }, scorers, assists] = await Promise.all([
    getUCLTableAction(),
    getUclScorersAction(),
    getUclAssistsAction(),
  ]);

  return (
    <UCLTableView
      table={table}
      completeness={completeness}
      mode={mode}
      scorers={scorers}
      assists={assists}
    />
  );
}
