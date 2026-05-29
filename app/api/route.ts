import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getHospitalPatientsByPerawatUsername } from '../../src/lib/get-hospital-patients';
import { createPatient } from '../../src/lib/post-patient';
import { deletePatient } from '../../src/lib/delete-patient';
import { updatePatientMedis } from '../../src/lib/update-patient';
import { getCurrentPerawat } from '@/lib/nurse-auth';

export async function GET() {
  try {
    const perawat = await getCurrentPerawat();

    if (!perawat) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Read-only: fetch only patients assigned to current logged-in nurse
    const data = await getHospitalPatientsByPerawatUsername(perawat.username, 50);
    return NextResponse.json({ patients: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log('📥 POST /api - Data diterima:', JSON.stringify(body, null, 2));
    
    // Validasi data wajib diisi
    if (!body.nama || !body.usia || !body.tanggal_lahir || !body.jenis_kelamin) {
      console.error('❌ Validasi gagal: Field wajib kosong');
      return NextResponse.json({ error: 'Nama, Usia, Tanggal Lahir, dan Jenis Kelamin wajib diisi' }, { status: 400 });
    }

    const id = await createPatient(body);
    console.log('✅ Data berhasil disimpan dengan ID:', id);
    
    revalidatePath('/dashboard');
    return NextResponse.json({ message: 'Data Pasien Berhasil Disimpan!', id }, { status: 201 });
  } catch (error: any) {
    console.error('❌ Error saat menyimpan data:', error.message);
    console.error('Stack trace:', error.stack);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('id');

    if (!patientId) {
      return NextResponse.json({ error: 'ID pasien tidak ditemukan' }, { status: 400 });
    }

    console.log('🗑️ DELETE /api - Menghapus pasien:', patientId);
    await deletePatient(patientId);
    
    revalidatePath('/dashboard');
    revalidatePath('/pasien');
    return NextResponse.json({ message: 'Pasien berhasil dihapus!' }, { status: 200 });
  } catch (error: any) {
    console.error('❌ Error saat menghapus pasien:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('id');
    const body = await request.json();

    if (!patientId) {
      return NextResponse.json({ error: 'ID pasien tidak ditemukan' }, { status: 400 });
    }

    console.log('✏️ PUT /api - Update data medis pasien:', patientId);
    const result = await updatePatientMedis(patientId, body);
    
    revalidatePath('/dashboard');
    revalidatePath('/pasien');
    return NextResponse.json({ message: 'Data medis pasien berhasil diperbarui!', data: result }, { status: 200 });
  } catch (error: any) {
    console.error('❌ Error saat update data:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
