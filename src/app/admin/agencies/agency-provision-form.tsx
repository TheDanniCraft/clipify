"use client";

import { IconMail } from "@tabler/icons-react";
import { provisionAgencyFormAction } from "@/app/actions/agency";
import { Button, Input, Label, ListBox, Select, TextField } from "@components/heroui-client";

export default function AgencyProvisionForm() {
	return (
		<form action={provisionAgencyFormAction} className='grid gap-4 md:grid-cols-2'>
			<TextField name='name' isRequired>
				<Label>Agency name</Label>
				<Input variant='secondary' placeholder='Northstar Management' />
			</TextField>
			<TextField name='ownerEmail' type='email' isRequired>
				<Label>First owner email</Label>
				<Input variant='secondary' placeholder='owner@agency.example' />
			</TextField>
			<TextField name='billingEmail' type='email' isRequired>
				<Label>Billing email</Label>
				<Input variant='secondary' placeholder='billing@agency.example' />
			</TextField>
			<TextField name='commercialReference'>
				<Label>Commercial reference</Label>
				<Input variant='secondary' placeholder='Contract or CRM reference' />
			</TextField>
			<Select name='collectionMethod' defaultValue='charge_automatically' variant='secondary' isRequired>
				<Label>Collection method</Label>
				<Select.Trigger>
					<Select.Value />
					<Select.Indicator />
				</Select.Trigger>
				<Select.Popover>
					<ListBox>
						<ListBox.Item id='charge_automatically' textValue='Card auto-pay'>
							Card auto-pay
							<ListBox.ItemIndicator />
						</ListBox.Item>
						<ListBox.Item id='send_invoice' textValue='Stripe invoice'>
							Stripe invoice
							<ListBox.ItemIndicator />
						</ListBox.Item>
					</ListBox>
				</Select.Popover>
			</Select>
			<TextField name='daysUntilDue' type='number'>
				<Label>Invoice payment days</Label>
				<Input variant='secondary' min={1} max={90} placeholder='14' />
			</TextField>
			<TextField name='creatorSeatPriceId' isRequired>
				<Label>Negotiated creator-seat Price ID</Label>
				<Input variant='secondary' placeholder='price_…' />
			</TextField>
			<TextField name='creatorSeatMinimum' type='number' isRequired>
				<Label>Creator-seat minimum</Label>
				<Input variant='secondary' min={0} placeholder='5' />
			</TextField>
			<TextField name='creatorSeatQuantity' type='number' isRequired>
				<Label>Initial creator seats</Label>
				<Input variant='secondary' min={0} placeholder='20' />
			</TextField>
			<TextField name='runnerSeatPriceId'>
				<Label>Negotiated Runner-seat Price ID</Label>
				<Input variant='secondary' placeholder='price_… (optional)' />
			</TextField>
			<TextField name='runnerSeatMinimum' type='number'>
				<Label>Runner-seat minimum</Label>
				<Input variant='secondary' min={0} defaultValue='0' />
			</TextField>
			<TextField name='runnerSeatQuantity' type='number'>
				<Label>Initial Runner seats</Label>
				<Input variant='secondary' min={0} defaultValue='0' />
			</TextField>
			<div className='md:col-span-2 flex justify-end border-t border-default pt-4'>
				<Button type='submit' variant='primary'>
					<IconMail aria-hidden='true' size={18} />
					Provision and invite owner
				</Button>
			</div>
		</form>
	);
}
