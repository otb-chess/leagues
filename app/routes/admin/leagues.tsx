import type {
  ActionFunction,
  ErrorBoundaryComponent,
  LoaderFunction,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  Form,
  useActionData,
  useLoaderData,
  useTransition,
} from "@remix-run/react";
import { XMarkIcon } from "@heroicons/react/20/solid";
import Button from "~/components/core/button";
import IconButton from "~/components/core/button/icon";
import { LEAGUE_SCHEMA } from "~/db/schemas.server";
import Input from "~/components/core/input";
import { useEffect, useRef } from "react";
import toast from "react-hot-toast";
import ErrorAlert from "~/components/core/alert/error";
import { AnimatePresence, motion } from "framer-motion";
import { createLeague, deleteLeague, getLeagues } from "~/db/leagues.server";
import { z } from "zod";

type LoaderData = Awaited<ReturnType<typeof getLeagues>>;

export const loader: LoaderFunction = async () => {
  return getLeagues();
};

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const { _action, ...values } = Object.fromEntries(formData);

  switch (_action) {
    case "delete":
      const deleteInput = z
        .object({
          leagueId: z.number(),
        })
        .safeParse({
          ...values,
          ...(values?.leagueId ? { leagueId: Number(values.leagueId) } : {}),
        });

      if (!deleteInput.success) {
        const errors = deleteInput.error.errors.reduce(
          (acc, { path, message }) => {
            return { ...acc, [path.join(".")]: message };
          },
          {}
        );
        return json({ errors, values });
      }

      const {
        data: { leagueId },
      } = deleteInput;
      await deleteLeague({ leagueId });

      return json({ result: "deleted" });

    case "create":
      const parsedInput = LEAGUE_SCHEMA.safeParse(values);

      if (!parsedInput.success) {
        const errors = parsedInput.error.errors.reduce(
          (acc, { path, message }) => {
            return { ...acc, [path.join(".")]: message };
          },
          {}
        );
        return json({ errors, values });
      }

      const { data } = parsedInput;
      await createLeague({
        league: data,
        select: { id: true },
      });

      return json({ result: "created" });
    default:
      throw new Error("Unrecognised request");
  }
};

export default function Leagues() {
  const formRef = useRef<HTMLFormElement>(null);
  const leagueName = useRef<HTMLInputElement>(null);
  const transition = useTransition();
  const leagues = useLoaderData<LoaderData>();
  const actionData = useActionData();
  const pendingAction =
    transition.state === "submitting" &&
    transition?.submission?.formData?.get("_action");
  const isSubmitting = !!pendingAction;
  const isSubmitted = actionData?.result;

  useEffect(() => {
    if (isSubmitted) {
      formRef?.current?.reset();
      leagueName?.current?.focus();
      if (actionData?.result === "created") {
        toast.success("Successfully added league");
      }
      if (actionData?.result === "deleted") {
        toast.success("Successfully deleted league");
      }
    }
  }, [actionData?.result, isSubmitted]);

  return (
    <div className="flex flex-wrap">
      <Form ref={formRef} method="post" className="w-full px-2 md:w-1/2">
        <fieldset disabled={transition.state === "submitting"}>
          <Input
            ref={leagueName}
            required
            label="League Name"
            name="name"
            defaultValue={actionData?.values?.name}
            error={actionData?.errors?.name}
          />

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={isSubmitting}
              loading={pendingAction === "create"}
              name="_action"
              value="create"
            >
              {pendingAction === "create" ? "Adding..." : "Add"}
            </Button>
          </div>
        </fieldset>
      </Form>

      <motion.div className="grow p-2 flex flex-col gap-2" layout>
        {leagues?.length ? (
          leagues.map((league) => (
            <AnimatePresence key={league.id} mode="popLayout">
              <motion.div
                className="shadow ring-1 ring-black ring-opacity-5 rounded-md p-2"
                whileHover={{ scale: 1.01 }}
              >
                <Form method="post" className="w-full">
                  <fieldset
                    className="flex items-center justify-between"
                    disabled={isSubmitting}
                  >
                    <span>{league.name}</span>
                    <Input type="hidden" name="leagueId" value={league.id} />
                    <IconButton
                      type="submit"
                      disabled={isSubmitting}
                      name="_action"
                      value="delete"
                      icon={<XMarkIcon className="h-6 w-6" />}
                      label={`Delete ${league.name}`}
                    />
                  </fieldset>
                </Form>
              </motion.div>
            </AnimatePresence>
          ))
        ) : (
          <p>No leagues yet...</p>
        )}
      </motion.div>
    </div>
  );
}

export const ErrorBoundary: ErrorBoundaryComponent = ({ error }) => {
  return (
    <ErrorAlert
      title="Error occurred in league form"
      detail={error.message}
    ></ErrorAlert>
  );
};
