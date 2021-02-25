import * as gracely from "gracely"
import { Context } from "./Context"
import { Request } from "./Request"
import { Response } from "./Response"
import { finish } from "./schedule"

export type Endpoint = (
	context: Partial<Context>,
	request: Omit<Partial<Request>, "body"> & { body?: Promise<any> | Record<string, unknown> | any }
) => Promise<Required<Response>>

export namespace Endpoint {
	export function create(endpoint: (context: Context, request: Request) => Promise<Response | any>): Endpoint {
		return async (context, request) => {
			const c = Context.create(context)
			const input = Request.create(request)
			const condition = !!request.baseUrl?.match("intergiro.com")
			let output: Response | any
			try {
				output = await endpoint(c, condition ? { ...input, body: toCamel(input.body) } : input)
			} catch (error) {
				c.log("servly.catch", "error", error)
				output = gracely.server.unknown()
			}
			const result = Response.create(condition ? toSnake(output) : output)
			await finish()
			return result
		}
	}
}

async function toCamel(snake?: Record<string, any>): Promise<Record<string, any> | undefined> {
	return snake
		? Object.fromEntries(
				Object.entries(snake).map(entry => [
					entry[0].replace(/([-_][a-z])/g, group => group.toUpperCase().replace("-", "").replace("_", "")),
					!Array.isArray(entry[1]) && typeof entry[1] == "object" ? toCamel(entry[1]) : entry[1],
				])
		  )
		: undefined
}

function toSnake(camel: any): any {
	return Array.isArray(camel)
		? camel.map(toSnake)
		: typeof camel == "object"
		? Object.fromEntries(
				Object.entries(camel).map(entry => [
					entry[0].replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`),
					!Array.isArray(entry[1]) && typeof entry[1] == "object" ? toSnake(entry[1]) : entry[1],
				])
		  )
		: camel
}
